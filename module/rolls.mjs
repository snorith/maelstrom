/**
 * Pure roll rules for Maelstrom (SPEC §1.3). No Foundry dependencies — keep it
 * that way so the rules stay testable outside the client.
 */

/**
 * Classify a 1d100 roll against a modified attribute target.
 *
 * @param {number} roll - the d100 result
 * @param {number} target - the stacked modifier total
 * @returns {"criticalsuccess"|"success"|"fail"|"criticalfail"}
 */
export function rollOutcome(roll, target) {
	if (roll >= 96) {
		return target <= 90 ? "criticalfail" : "fail";
	}
	if (roll > target) return "fail";
	if (roll <= Math.floor(target / 10)) return "criticalsuccess";
	return "success";
}

/**
 * Stack an attribute value and its modifiers into a roll target.
 * Non-finite entries are dropped; the total floors at 0.
 *
 * @param {Array<number|null|undefined>} values - attribute value first, then modifiers
 * @returns {{total: number, terms: number[]}}
 */
export function stackModifiers(values) {
	const terms = values.filter((v) => Number.isFinite(v));
	const sum = terms.reduce((a, b) => a + b, 0);
	return { total: Math.max(sum, 0), terms };
}

/**
 * Human-readable breakdown: "40 + -10 + 5 = 35", or just "40" for a single term.
 *
 * @param {{total: number, terms: number[]}} stacked
 * @returns {string}
 */
export function formatBreakdown({ total, terms }) {
	if (terms.length <= 1) return String(total);
	return `${terms.join(" + ")} = ${total}`;
}
