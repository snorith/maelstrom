export type maelstromConfigType = {
    attributes: string[],
    physicalAttributes: string[]
}

export const MAELSTROM: maelstromConfigType = {
    attributes: [
        "attack",
        "missile",
        "defence",
        "knowledge",
        "will",
        "endurance",
        "persuasion",
        "perception",
        "speed",
        "agility"
    ],

    physicalAttributes: [
        "attack",
        "missile",
        "defence",
        "speed",
        "agility"
    ]
}
