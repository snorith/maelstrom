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

// @ts-ignore
// @ts-ignore
export const MaelstromItem = new Proxy(function () {}, {

    //Calling a constructor from this proxy object
	// @ts-ignore
    construct: function (target, info, ...args) {
        const [data, newTarget] = info

        console.log('construct item type = ' + data.type)

        switch (data.type) {
            case MaelstromAbilityItem.type:
            	data.img = data.img || 'icons/svg/aura.svg'
                return new MaelstromAbilityItem(data, newTarget)
            case MaelstromWeaponItem.type:
				data.img = data.img || 'icons/svg/combat.svg'
                return new MaelstromWeaponItem(data, newTarget)
			default:
				console.log('Unknown item type = ' + data.type)
        }
    },

    //Property access on this weird, dirty proxy object
    get: function (target, prop, receiver) {
        switch (prop) {
            case "create":
			case "createDocuments":
                //Calling the class' create() static function
                return function (data, options) {
                    console.log('new item type = ' + data.type)

					if (data.constructor === Array) {
						//Array of data, this happens when creating Actors imported from a compendium
						// @ts-ignore
						return data.map(i => MaelstromItem.create(i, options));
					}

					switch (data.type) {
                        case MaelstromAbilityItem.type:
                            return MaelstromAbilityItem.create(data, options)
                        case MaelstromWeaponItem.type:
                            return MaelstromWeaponItem.create(data, options)
						default:
							console.log('Unknown item type: ' + data.type)
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
