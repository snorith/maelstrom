/**
 * Maelstrom item base class
 *
 * Acts as a mix of factory and proxy: depending on its "type" argument,
 * creates an object of the right class (also extending Item) and simply
 * overrides its own properties with that of that new objects.
 *
 * This is used since Item doesn't really allow for real inheritance, so
 * we're simply faking it. #yolo #ididntchoosethethuglife
 *
 * @export
 * @class MaelstromItem
 * @extends {Item}
 */
import {MaelstromAbilityItem} from "./MaelstromAbilityItem"
import {MaelstromWeaponItem} from "./MaelstromWeaponItem"

export const MaelstromItem = new Proxy(function () {}, {

    //Calling a constructor from this proxy object
    construct: function (target, info, ...args) {
        const [data, newTarget] = info

        console.log('construct item type = ' + data.type)

        switch (data.type) {
            case MaelstromAbilityItem.type:
                return new MaelstromAbilityItem(data, newTarget)
            case MaelstromWeaponItem.type:
                return new MaelstromWeaponItem(data, newTarget)
        }
    },

    //Property access on this weird, dirty proxy object
    get: function (target, prop, receiver) {
        switch (prop) {
            case "create":
                //Calling the class' create() static function
                return function (data, options) {
                    console.log('new item type = ' + data.type)

                    switch (data.type) {
                        case MaelstromAbilityItem.type:
                            return MaelstromAbilityItem.create(data, options)
                        case MaelstromWeaponItem.type:
                            return MaelstromWeaponItem.create(data, options)
                    }
                };

            case Symbol.hasInstance:
                //Applying the "instanceof" operator on the instance object
                return function (instance) {
                    return (
                        instance instanceof MaelstromAbilityItem ||
                        instance instanceof MaelstromWeaponItem ||
                        // other instanceof
                        false
                    );
                };

            default:
                //Just forward any requested properties to the base Actor class
                return Item[prop];
        }
    },
});
