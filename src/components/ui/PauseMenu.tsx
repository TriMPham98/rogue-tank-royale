// Pause Menu component — includes minimal coin shop (field supply sink)
import React from "react";
import { GAME_CONSTANTS } from "../../constants/game";

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
            FIELD SUPPLY <span className="coin-balance">{coins} coins</span>
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
            aria-label={`Field repair for ${repairCost} coins`}>
            FIELD REPAIR (+{GAME_CONSTANTS.HEALTH_PACK_HEAL_AMOUNT} HP) —{" "}
            {repairCost}¢
          </button>
          <button
            className="ui-button supply-button"
            onClick={onPurchasePlating}
            disabled={!canPlating}
            title={`+${GAME_CONSTANTS.COIN_PLATING_MAX_HEALTH} max hull`}
            aria-label={`Reinforced plating for ${platingCost} coins`}>
            REINFORCED PLATING (+{GAME_CONSTANTS.COIN_PLATING_MAX_HEALTH} MAX) —{" "}
            {platingCost}¢
          </button>
        </div>

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
