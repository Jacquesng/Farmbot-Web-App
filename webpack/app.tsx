import * as React from "react";
import { t } from "i18next";
import { connect } from "react-redux";
import * as _ from "lodash";
import { init, error } from "farmbot-toastr";

import { NavBar } from "./nav";
import { Everything, Log } from "./interfaces";
import { LoadingPlant } from "./loading_plant";
import { BotState, Xyz } from "./devices/interfaces";
import { ResourceName, TaggedUser } from "./resources/tagged_resources";
import {
  selectAllLogs,
  maybeFetchUser,
  maybeGetTimeOffset
} from "./resources/selectors";
import { HotKeys } from "./hotkeys";
import { ControlsPopup } from "./controls_popup";
import { Content } from "./constants";
import { catchErrors, validBotLocationData } from "./util";
import { Session } from "./session";
import { BooleanSetting } from "./session_keys";
import { getPathArray } from "./history";

/** Remove 300ms delay on touch devices - https://github.com/ftlabs/fastclick */
const fastClick = require("fastclick");
fastClick.attach(document.body);

/** For the logger module */
init();

export interface AppProps {
  dispatch: Function;
  loaded: ResourceName[];
  logs: Log[];
  user: TaggedUser | undefined;
  bot: BotState;
  consistent: boolean;
  autoSyncEnabled: boolean;
  timeOffset: number;
  axisInversion: Record<Xyz, boolean>;
}

function mapStateToProps(props: Everything): AppProps {
  return {
    timeOffset: maybeGetTimeOffset(props.resources.index),
    dispatch: props.dispatch,
    user: maybeFetchUser(props.resources.index),
    bot: props.bot,
    logs: _(selectAllLogs(props.resources.index))
      .map(x => x.body)
      .sortBy("created_at")
      .reverse()
      .take(250)
      .value(),
    loaded: props.resources.loaded,
    consistent: !!(props.bot || {}).consistent,
    autoSyncEnabled: !!props.bot.hardware.configuration.auto_sync,
    axisInversion: {
      x: !!Session.deprecatedGetBool(BooleanSetting.x_axis_inverted),
      y: !!Session.deprecatedGetBool(BooleanSetting.y_axis_inverted),
      z: !!Session.deprecatedGetBool(BooleanSetting.z_axis_inverted),
    }
  };
}
/** Time at which the app gives up and asks the user to refresh */
const LOAD_TIME_FAILURE_MS = 25000;

/**
 * Relational resources that *must* load before app starts.
 * App will crash at load time if they are not pre-loaded.
 */
const MUST_LOAD: ResourceName[] = [
  "Sequence",
  "Regimen",
  "FarmEvent",
  "Point"
];

@connect(mapStateToProps)
export class App extends React.Component<AppProps, {}> {
  componentDidCatch(x: Error, y: React.ErrorInfo) { catchErrors(x, y); }

  get isLoaded() {
    return (MUST_LOAD.length ===
      _.intersection(this.props.loaded, MUST_LOAD).length);
  }

  /**
 * If the sync object takes more than 10s to load, the user will be granted
 * access into the app, but still warned.
 */
  componentDidMount() {
    setTimeout(() => {
      if (!this.isLoaded) {
        error(t(Content.APP_LOAD_TIMEOUT_MESSAGE), t("Warning"));
      }
    }, LOAD_TIME_FAILURE_MS);
  }

  render() {
    const syncLoaded = this.isLoaded;
    const currentPage = getPathArray()[2];
    const { location_data, mcu_params } = this.props.bot.hardware;
    return <div className="app">
      <HotKeys dispatch={this.props.dispatch} />
      <NavBar
        timeOffset={this.props.timeOffset}
        consistent={this.props.consistent}
        user={this.props.user}
        bot={this.props.bot}
        dispatch={this.props.dispatch}
        logs={this.props.logs}
        autoSyncEnabled={this.props.autoSyncEnabled}
      />
      {!syncLoaded && <LoadingPlant />}
      {syncLoaded && this.props.children}
      {!(["controls", "account", "regimens"].includes(currentPage)) &&
        <ControlsPopup
          dispatch={this.props.dispatch}
          axisInversion={this.props.axisInversion}
          botPosition={validBotLocationData(location_data).position}
          mcuParams={mcu_params} />}
    </div>;
  }
}
