import {systemBasePath} from "../settings"

export function WaitForModifierDialog(actor: Actor): Promise<any> {
    return new Promise((resolve, reject) => {
        new ModifierDialog(actor, {
            closeFunction: () => resolve(false)
        }).render(true)
    })
}

export class ModifierDialog extends FormApplication {
    /**
     * @inheritDoc
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["boilerplate", "modifier"],
            title: game.i18n.localize("MAELSTROM.roll.dialog.title"),
            template: `${systemBasePath}/templates/dialog/modifier.html`,
            editable: true,
            width: 300,
            height: 150,
        });
    }

    /**
     * @inheritdoc
     */
    constructor(actor, options = {}) {
        const modifierDialogObject = {
            actor,
            modifier: 0
        };

        super(modifierDialogObject, options);
    }

    /**
     * @inheritdoc
     */
    getData() {
        const data = super.getData();

        return mergeObject(data, {
            modifier: this.object.modifier,
            dialogid: this.id
        });
    }

    /**
     * @inheritdoc
     */
    activateListeners(html) {
        super.activateListeners(html);

        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.options.editable) {
            return;
        }

        // wait for 'continue' button to be pressed
        html.find("#apply-modifier").click(this._accept.bind(this))

        // On focus on one numeric element, select all text for better experience
        html.find(".select-on-focus").on("focus", (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.target.select();
        });
    }

    /**
     * Event handler for the "Accept" button. Applies the pool changes to the
     * Actor.
     *
     * @memberof RecoveryDialog
     */
    async _accept(event) {
        event.preventDefault()
        event.stopPropagation()

        this.submit({})

        return false
    }

    _updateObject(event, formData): Promise<any> {
        const modifier = formData["modifier"]
        this._updateLocalValue(modifier)

        //Re-render the form since it's not provided for free in FormApplications
        this.render();

        return new Promise<any>((resolve, reject) => {
            resolve(false)
        }).catch(reason => {
        })
    }

    close(): Promise<void> {
        this._updateActorValue().then(value => {
            this.options.closeFunction()
        }).catch(reason => {
            ui.notifications.error("A problem occurred updating the character with the modifier value")
            this.options.closeFunction()
        })

        // the dialog won't close with a 'state' of 'closing', only if it's 'rendered' or 'error'
        this._state = Application.RENDER_STATES.RENDERED
        return super.close();
    }

    _updateLocalValue(modifierStr: any) {
        let modifier = Number.parseInt(modifierStr)
        if (isNaN(modifier))
            modifier = 0;

        this.object.modifier =  modifier
    }

    _updateActorValue(): Promise<any> {
        const dataUpdate = {
            data: {
                roll: {
                    modifier: this.object.modifier
                }
            }
        }

        const actor = this.object.actor as Actor
        return actor.update(dataUpdate)
    }
}
