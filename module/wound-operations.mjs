/**
 * Pure wound operations shared by clients and the GM coordinator.
 * These rules do not perform document writes or confer actor permissions.
 * State: {wounds: Array<number|null> (11 slots), bloodloss: number|null}.
 */
export class WoundOperationError extends Error {
	constructor(code) {
		super(code);
		this.name = "WoundOperationError";
		this.code = code;
	}
}

const finiteOrNull = (value) => value === null || (typeof value === "number" && Number.isFinite(value));
const sameValue = (left, right) => (left ?? 0) === (right ?? 0);

/** Reject malformed operations at the request boundary; never coerce wire data. */
export function validateWoundOperation(operation) {
	if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
		throw new WoundOperationError("invalidOperation");
	}
	let keys;
	switch (operation.type) {
		case "healAll":
		case "applyBleeding":
			keys = ["type"];
			break;
		case "setWound":
			if (!Number.isInteger(operation.slot) || operation.slot < 0 || operation.slot > 10) {
				throw new WoundOperationError("invalidOperation");
			}
			keys = ["type", "slot", "expectedValue", "value"];
			break;
		case "setBleedingCount":
			keys = ["type", "expectedValue", "value"];
			break;
		default:
			throw new WoundOperationError("invalidOperation");
	}
	if (Object.keys(operation).some((key) => !keys.includes(key))
		|| keys.some((key) => !Object.hasOwn(operation, key))) {
		throw new WoundOperationError("invalidOperation");
	}
	if (keys.includes("value")
		&& (!finiteOrNull(operation.value) || !finiteOrNull(operation.expectedValue))) {
		throw new WoundOperationError("invalidOperation");
	}
}

/**
 * Apply an operation to the CURRENT authoritative state, returning a new state.
 * Same-slot stale edits fail; changes to unrelated slots remain compatible.
 * Blank and zero compare equally because the sheet renders both as blank.
 * Numeric behavior matches the existing system, including finite legacy negatives.
 */
export function applyWoundOperation(state, operation) {
	validateWoundOperation(operation);
	if (!Array.isArray(state?.wounds) || state.wounds.length !== 11
		|| Array.from(state.wounds).some((value) => !finiteOrNull(value))
		|| !finiteOrNull(state.bloodloss)) {
		throw new WoundOperationError("invalidState");
	}
	const next = { wounds: [...state.wounds], bloodloss: state.bloodloss };
	switch (operation.type) {
		case "healAll":
			next.wounds = next.wounds.map((value) => value > 0 ? value - 1 : 0);
			break;
		case "applyBleeding":
			if (next.bloodloss > 0) next.wounds[10] = (next.wounds[10] ?? 0) + next.bloodloss;
			break;
		case "setWound":
			if (!sameValue(next.wounds[operation.slot], operation.expectedValue)) {
				throw new WoundOperationError("conflict");
			}
			next.wounds[operation.slot] = operation.value;
			break;
		case "setBleedingCount":
			if (!sameValue(next.bloodloss, operation.expectedValue)) {
				throw new WoundOperationError("conflict");
			}
			next.bloodloss = operation.value;
	}
	if (!Number.isFinite(next.wounds.reduce((total, value) => total + (value ?? 0), 0))) {
		throw new WoundOperationError("invalidState");
	}
	return next;
}
