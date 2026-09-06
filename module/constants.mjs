/**
 * Shared constants. Kept in their own dependency-free module: sheet classes use
 * these in static field initializers, which evaluate at module-load time — an
 * import cycle through maelstrom.mjs would hit the TDZ and crash the whole
 * system load (this happened; see z/PLAN.md rollout notes).
 */

export const SYSTEM_ID = "maelstrom";

/**
 * Combat initiative formula: 2d10 + speed + modifier, with speed/100 as a
 * deterministic tie-breaker (2 decimals shown in the tracker).
 */
export const INITIATIVE_FORMULA =
	"2d10 + @attributes.speed.current + @initiative.modifier + (@attributes.speed.current / 100)";
