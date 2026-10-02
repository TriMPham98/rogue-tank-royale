// Pause Menu component — includes minimal coin shop (field supply sink)
import React from "react";
import { GAME_CONSTANTS } from "../../constants/game";
import { formatSupply } from "../../state/progression";

interface PauseMenuProps {
  coins: number;
  playerHealth: number;
  playerMaxHealth: number;
  onResume: () => void;
  onMainMenu: () => void;
  onSettings: () => void;
  onPurchaseRepair: () => boolean;
  onPurchasePlating: () => boolean;
}

const PauseMenu: React.FC<PauseMenuProps> = ({
  coins,
  playerHealth,
  playerMaxHealth,
  onResume,
  onMainMenu,
  onSettings,
  onPurchaseRepair,
  onPurchasePlating,
}) => {
  const repairCost = GAME_CONSTANTS.COIN_REPAIR_COST;
  const platingCost = GAME_CONSTANTS.COIN_PLATING_COST;
  const canRepair =
    coins >= repairCost && playerHealth < playerMaxHealth;
  const canPlating = coins >= platingCost;

  return (
    <div className="overlay pause-overlay">
      <div className="overlay-content pause-content">
        <h2 className="pause-title">OPERATION PAUSED</h2>

        <div className="field-supply">
          <div className="field-supply-header">
            FIELD SUPPLY{" "}
            <span className="coin-balance">{formatSupply(coins)} SP</span>
          </div>
          <button
            className="ui-button supply-button"
            onClick={onPurchaseRepair}
            disabled={!canRepair}
            title={
              playerHealth >= playerMaxHealth
                ? "Hull already at full integrity"
                : `Restore ${GAME_CONSTANTS.HEALTH_PACK_HEAL_AMOUNT} HP`
            }
            aria-label={`Field repair for ${repairCost} supply`}>
            FIELD REPAIR (+{GAME_CONSTANTS.HEALTH_PACK_HEAL_AMOUNT} HP) —{" "}
            {formatSupply(repairCost)} SP
          </button>
          <button
            className="ui-button supply-button"
            onClick={onPurchasePlating}
            disabled={!canPlating}
            title={`+${GAME_CONSTANTS.COIN_PLATING_MAX_HEALTH} max hull`}
            aria-label={`Reinforced plating for ${platingCost} supply`}>
            REINFORCED PLATING (+{GAME_CONSTANTS.COIN_PLATING_MAX_HEALTH} MAX) —{" "}
            {formatSupply(platingCost)} SP
          </button>
        </div>

        <p className="supply-bank-hint">
          Half of any unspent supply is salvaged for permanent Armory upgrades when the run ends.
        </p>

        <button className="ui-button main-menu-button" onClick={onMainMenu}>
          MAIN MENU
        </button>
        <button className="ui-button main-menu-button" onClick={onSettings}>
          SETTINGS
        </button>
        <button className="ui-button resume-button" onClick={onResume}>
          RESUME
        </button>
      </div>
    </div>
  );
};

export default PauseMenu;
