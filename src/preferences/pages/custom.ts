imports.gi.versions.Gtk = '3.0'

// imports.gi
import * as GObject                    from '@gi/GObject'
import * as Hdy                        from '@gi/Handy'

// local modules
import { list_children, show_err_msg } from '../../utils/prefs'
import { template_url }                from '../../utils/io'
import { _logError }                   from '../../utils/log'
import constants                       from '../../utils/constants'
import settings                        from '../../utils/settings'
import connections                     from '../../utils/connections'
import AppRow                          from '../widgets/app-row'
import RoundedCornersItem              from '../widgets/rounded-corners-item'

// types
import { Align, Switch }               from '@gi/Gtk'
import { Button, Widget, Box }         from '@gi/Gtk'
import { AppRowHandler }               from '../widgets/app-row'
import { CustomRoundedCornersCfg }     from '../../utils/types'
import { RoundedCornersCfg }           from '../../utils/types'
import { imports }                     from '@global'

// --------------------------------------------------------------- [end imports]

export const Custom = GObject.registerClass (
    {
        Template: template_url (import.meta.url, './custom.ui'),
        GTypeName: 'CustomPage',
        InternalChildren: ['custom_group', 'add_row_btn'],
    },
    class extends Hdy.PreferencesPage {
        private _custom_group !: Hdy.PreferencesGroup
        private _add_row_btn  !: Button

        private _settings_cfg !: CustomRoundedCornersCfg

        _init () {
            super._init ()
            this._settings_cfg = settings ().custom_rounded_corner_settings

            for (const k in this._settings_cfg) {
                this.add_row (k, this._settings_cfg[k])
            }

            connections.get ().connect (this._add_row_btn, 'clicked', () => {
                const title = ''

                if (this._settings_cfg[title]) {
                    this.show_exists_error_toast (title)
                    return
                }

                const cfg = settings ().global_rounded_corner_settings
                this.add_row (title, cfg)

                this._settings_cfg[title] = cfg
            })
        }

        private add_row (
            title: string,
            cfg: RoundedCornersCfg
        ): Hdy.ExpanderRow {
            const rounded_corners_item = new RoundedCornersItem ()

            const enabled_switch = new Switch ({
                valign: Align.CENTER,
                active: true,
                visible: true,
            })

            rounded_corners_item.cfg = cfg
            enabled_switch.active = cfg.enabled

            const handler = {
                on_delete: (row) => {
                    const title = row.title

                    rounded_corners_item.unwatch ()
                    connections.get ().disconnect_all (enabled_switch)
                    this._custom_group.remove (row)

                    delete this._settings_cfg[title]
                    settings ().custom_rounded_corner_settings =
                        this._settings_cfg
                },
                on_title_changed: (old_title, new_title) => {
                    if (this._settings_cfg[new_title] !== undefined) {
                        this.show_exists_error_toast (new_title)
                        return false
                    }

                    const cfg = this._settings_cfg[old_title]
                    delete this._settings_cfg[old_title]
                    this._settings_cfg[new_title] = cfg

                    settings ().custom_rounded_corner_settings =
                        this._settings_cfg

                    return true
                },
                on_open: (row) => {
                    rounded_corners_item.watch ((cfg) => {
                        cfg.enabled = enabled_switch.active
                        this._on_cfg_changed (row.title, cfg)
                    })
                    connections
                        .get ()
                        .connect (enabled_switch, 'state-set', () => {
                            const cfg = rounded_corners_item.cfg
                            cfg.enabled = enabled_switch.active
                            this._on_cfg_changed (row.title, cfg)
                            return false
                        })
                },
                on_close: () => {
                    rounded_corners_item.unwatch ()
                    connections.get ().disconnect_all (enabled_switch)
                },
            } as AppRowHandler

            const expanded_row = new AppRow ({ title }, handler)

            if (title == '') {
                expanded_row.subtitle = constants.TIPS_EMPTY
            }

            this._custom_group.add (expanded_row)

            const enabled_row = new Hdy.ActionRow ({
                title: 'Enabled',
                subtitle: 'Enable custom settings for this window',
                activatable_widget: enabled_switch,
                visible: true,
            })

            // Add switch into suffix of ActionRow
            // HdyActionRow not have a method like `hdy_action_row_add_suffix`
            // So we have to find the child then add it manually
            try {
                enabled_row.set_activatable_widget (enabled_switch)
                const suffix = (
                    enabled_row.get_child () as Box
                ).get_children ()[3] as Box
                suffix.visible = true
                suffix.pack_end (enabled_switch, false, false, 0)
            } catch (e) {
                _logError (e as Error)
            }

            add_row (expanded_row, enabled_row)

            list_children (rounded_corners_item)
                .filter ((child) => child.name != constants.DON_T_CONFIG)
                .forEach ((child) => {
                    rounded_corners_item.remove (child)
                    add_row (expanded_row, child)
                    enabled_switch.bind_property (
                        'active',
                        child,
                        'sensitive',
                        GObject.BindingFlags.SYNC_CREATE
                    )
                })

            return expanded_row
        }

        private show_exists_error_toast (title: string) {
            const tip =
                `'${title}': ` +
                'can\'t add into list, because this item has exists'
            show_err_msg (tip)
        }

        private _on_cfg_changed (k: string, v: RoundedCornersCfg) {
            this._settings_cfg[k] = v
            settings ().custom_rounded_corner_settings = this._settings_cfg
        }
    }
)

function add_row (parent: Hdy.ExpanderRow, child: Widget) {
    parent.add (child)
}
