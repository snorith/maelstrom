// Uses an installed Foundry v14 copy; no proprietary source is vendored.
// FOUNDRY_APP_PATH=/path/to/resources/app node --test tests/regressions.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const app = process.env.FOUNDRY_APP_PATH;
if (!app) throw new Error("Set FOUNDRY_APP_PATH to your Foundry v14 resources/app directory.");
const core = (path) => import(pathToFileURL(resolve(app, path)));
// Foundry normally installs this convenience extension during client boot.
Object.defineProperty(Array.prototype, "filterJoin", { value(separator) { return this.filter(Boolean).join(separator); } });
const fields = await core("common/data/fields.mjs");
const { default: TypeDataModel } = await core("common/abstract/type-data.mjs");
const { default: DataModel } = await core("common/abstract/data.mjs");
const utils = await core("common/utils/_module.mjs");
globalThis.foundry = { data: { fields }, abstract: { TypeDataModel, DataModel }, utils };
globalThis.game = { i18n: { localize: (s) => s, format: (s) => s }, settings: { get: () => 1 } };
globalThis.CONFIG = {};

const { CharacterData } = await import("../module/data/character-data.mjs");
const { WeaponData } = await import("../module/data/weapon-data.mjs");

// Reproduce the backend boundary: real schema cleaning BEFORE _preUpdate,
// and authoritative state changes only after the asynchronous write returns.
globalThis.Actor = class {
  constructor() {
    this.type = "character";
    this.system = new CharacterData({ wounds: { wounds: [4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0], bloodloss: 2 } });
    this._source = { type: this.type, system: this.system.toObject() };
  }
  static cleanData(data, options, state) {
    data = utils.expandObject(utils.deepClone(data));
    if (data.system) data.system = CharacterData.cleanData(data.system,
      { ...options, sanitize: false }, { source: state.source.system, model: state.model?.system });
    return data;
  }
  async _preUpdate() {}
  async update(data) {
    const changes = this.constructor.cleanData(data, { partial: true, migrate: true },
      { source: this._source, model: this });
    await this._preUpdate(changes, {}, {});
    await new Promise((resolve) => setImmediate(resolve));
    if (this.failNext) { this.failNext = false; throw new Error("write failed"); }
    this._source = utils.mergeObject(this._source, changes);
    this.system = new CharacterData(this._source.system);
    return this;
  }
};
const { MaelstromActor } = await import("../module/documents/actor.mjs");
const { applyWoundOperation } = await import("../module/wound-operations.mjs");
// The authenticated transport is tested separately. Here exercise the actor
// methods through their public operation API and the real schema boundary.
game.maelstrom = { wounds: { async submit(actor, operation) {
  const next = applyWoundOperation({ wounds: actor.system.wounds.wounds, bloodloss: actor.system.wounds.bloodloss }, operation);
  return actor.update({ "system.wounds.wounds": next.wounds, "system.wounds.bloodloss": next.bloodloss });
} } };

test("partial wound update retains other slots through real v14 schema cleaning", async () => {
  const actor = new MaelstromActor();
  await actor.update({ "system.wounds.wounds.3": 5 });
  assert.deepEqual(actor.system.wounds.wounds.slice(0, 4), [4, 2, 0, 5]);
  await actor.update({ system: { wounds: { wounds: { 0: "", 10: 3 } } } });
  assert.equal(actor.system.wounds.wounds[0], null);
  assert.equal(actor.system.wounds.wounds[1], 2);
  assert.equal(actor.system.wounds.wounds[10], 3);
});

test("full-array replacement and unrelated updates keep their semantics", async () => {
  const actor = new MaelstromActor();
  await actor.update({ "system.age": 25 });
  assert.equal(actor.system.wounds.wounds[0], 4);
  await actor.update({ "system.wounds.wounds": Array(11).fill(0) });
  assert.equal(actor.system.totalWounds, 0);
});

test("indexed preservation handles dotted paths and both protection seams independently", async () => {
  const updates = [
    { "system.wounds.wounds.3": 5 },
    { "system.wounds.wounds": { 3: 5 } },
    { "system.wounds": { "wounds.3": 5 } },
    { system: { "wounds.wounds.3": 5 } },
    { system: { wounds: { "wounds.3": 5 } } },
    { system: { wounds: { wounds: { 3: 5 } } } }
  ];
  class InstanceOnly extends MaelstromActor {
    static cleanData(...args) { return Actor.cleanData(...args); }
  }
  for (const update of updates) {
    const actor = new InstanceOnly();
    await actor.update(update);
    assert.deepEqual(actor.system.wounds.wounds.slice(0, 4), [4, 2, 0, 5]);
    const source = new MaelstromActor();
    const cleaned = MaelstromActor.cleanData(update, { partial: true, migrate: true }, { source: source._source, model: source });
    assert.deepEqual(cleaned.system.wounds.wounds.slice(0, 4), [4, 2, 0, 5]);
  }
});

test("legacy order survives actual v14 initialization and source pruning", () => {
  const weapon = new WeaponData({ order: 5, as: "", lastOrder: 10 });
  assert.equal(weapon._source.order, 5);
  assert.equal(weapon.as, null);
  assert.equal(new WeaponData({}).order, null);
});

test("journal projection drives real character wounds and HP without rewriting the legacy source", async () => {
  const { readWoundJournal, nextWoundRevision } = await import("../module/wound-journal.mjs");
  const actor = new MaelstromActor();
  actor.uuid = "Actor.projected";
  const head = readWoundJournal([], actor.uuid, actor.system.wounds);
  const record = nextWoundRevision(head, { id: "projected-request", senderId: "gm", operation: { type: "applyBleeding" } });
  actor.items = [{ toObject: () => record, getFlag: (scope, key) => record.flags?.[scope]?.[key] }];
  class ParentModel extends DataModel { static TYPES = []; static defineSchema() { return {}; } }
  const parent = new ParentModel();
  parent.uuid = actor.uuid;
  parent.items = actor.items;
  const model = new CharacterData(actor._source.system, { parent });
  model.prepareDerivedData();
  assert.equal(model.wounds.wounds[10], 2);
  assert.equal(model.hp.wounds, 8);
  assert.equal(model._source.wounds.wounds[10], 0);
  await assert.rejects(actor.update({ "system.wounds.wounds.0": 50 }), /applyWoundOperation/);
});

test("rapid bleeding and mixed wound actions accumulate in invocation order", async () => {
  const actor = new MaelstromActor();
  await Promise.all([actor.sufferBleedingDamage(), actor.sufferBleedingDamage()]);
  assert.equal(actor.system.wounds.wounds[10], 4);
  await Promise.all([actor.healAllWoundsByOne(), actor.sufferBleedingDamage()]);
  assert.deepEqual(actor.system.wounds.wounds.slice(0, 2), [3, 1]);
  assert.equal(actor.system.wounds.wounds[10], 5);
});

test("a rejected wound write does not poison subsequent actions", async () => {
  const actor = new MaelstromActor();
  actor.failNext = true;
  await assert.rejects(actor.sufferBleedingDamage(), /write failed/);
  await actor.sufferBleedingDamage();
  assert.equal(actor.system.wounds.wounds[10], 2);
});

test("world migration consumes retained order once and explicit repair handles stamped worlds", async () => {
  const { migrateWorld } = await import("../module/migrations.mjs");
  let version = 2;
  const makeItem = (id, order) => ({
    id, type: "weapon", sort: 999,
    _source: { system: new WeaponData({ order }).toObject() },
    async update(data) {
      this.sort = data.sort;
      this._source.system.order = data["system.order"];
    }
  });
  const embedded = makeItem("embedded", 5);
  const world = makeItem("world", 0);
  game.user = { isGM: true };
  game.settings = { get: () => version, set: async (_id, _key, value) => { version = value; } };
  game.actors = [{ id: "actor", name: "fixture", items: [embedded],
    async updateEmbeddedDocuments(_type, updates) {
      for (const update of updates) await embedded.update(update);
    }
  }];
  game.items = [world];
  game.scenes = [];
  await migrateWorld();
  assert.equal(embedded.sort, 999, "do not silently overwrite an already-migrated world");
  await migrateWorld({ repairLegacyOrder: true });
  assert.equal(embedded.sort, 6000);
  assert.equal(world.sort, 1000);
  assert.equal(embedded._source.system.order, null);
  embedded.sort = 7000;
  await migrateWorld({ repairLegacyOrder: true });
  assert.equal(embedded.sort, 7000, "consumed legacy order cannot overwrite a later manual sort");
});

test("actor tooltips request ownership-filtered notes for both item types", async () => {
  game.user = { isGM: false };
  class Sheet {
    constructor(actor) { this.actor = actor; this.isEditable = false; }
    async _prepareContext() { return {}; }
    _prepareTabs() { return {}; }
    _processFormData(_event, _form, formData) { return utils.expandObject(formData.object); }
  }
  const calls = [];
  foundry.applications = {
    api: { HandlebarsApplicationMixin: (cls) => cls },
    sheets: { ActorSheetV2: Sheet },
    ux: { TextEditor: { async enrichHTML(html, options) {
      calls.push(options);
      // A deterministic stand-in for core's secret-removal behavior; the
      // integration assertion is that raw HTML never bypasses this result.
      return options.secrets ? html : "<p>Visible notes</p>";
    } } }
  };
  const { MaelstromCharacterSheet } = await import("../module/apps/actor-sheet.mjs");
  const actor = new MaelstromActor();
  actor.getRollData = () => actor.system;
  actor.items = ["weapon", "ability"].map((type, id) => ({
    id, type, name: type, img: "icons/svg/item-bag.svg", sort: 0, isOwner: false,
    system: { notes: '<section class="secret">GM SECRET</section>', attributes: {} }
  }));
  actor.items.push({ id: "lease", type: "equipment", system: { notes: "Internal" } });
  const sheet = new MaelstromCharacterSheet(actor);
  const unrelatedEdit = sheet._processFormData({}, {}, { object: {
    name: "New name", "system.wounds.wounds.0": 99,
    "system.wounds.bloodloss": 7, "system.wounds.injuries": "Keep this note"
  } });
  assert.deepEqual(unrelatedEdit, { name: "New name", system: { wounds: { injuries: "Keep this note" } } },
    "ordinary sheet submissions must exclude stale wound numbers but retain wound notes");
  const context = await sheet._prepareContext({});
  for (const item of [...context.weapons, ...context.abilities]) {
    assert.doesNotMatch(item.tooltip, /GM SECRET/);
    assert.match(item.tooltip, /Visible notes/);
  }
  for (const item of actor.items) {
    if (item.type === "equipment") {
      assert.ok(!calls.some((options) => options.relativeTo === item), "hidden lease needs no tooltip enrichment");
      continue;
    }
    assert.ok(calls.some((options) => options.relativeTo === item && options.secrets === false));
  }
  actor.items.forEach((item) => { item.isOwner = true; });
  const ownerContext = await sheet._prepareContext({});
  assert.match(ownerContext.weapons[0].tooltip, /GM SECRET/);
});
