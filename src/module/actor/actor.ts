export class MaelstromActor extends Actor {
    prepareData() {
        super.prepareData();

        const actorData = this.data
        const data = actorData.data
        const flags = data.flags

        if (actorData.type == 'character')
            this._prepareCharacterData(actorData)
    }

    _prepareCharacterData(actorData: ActorData<any>) {
        const data = actorData.data

        // Make modifications to data here ...

        for (let [key, attribute] of Object.entries(data.attributes)) {
            // calculate modifiers... d20 style
            //attribute.mod = Math.floor((attribute.orig - 10) / 2)
        }
    }
}
