// Armory: spend banked supply on permanent upgrades that apply to every run
import React from "react";
import "./ArmoryPanel.css";
import {
  PERM_UPGRADES,
  formatSupply,
  permUpgradeCost,
  useProgression,
  type PermUpgradeId,
} from "../../state/progression";
import SoundManager from "../../utils/sound";

interface ArmoryPanelProps {
  compact?: boolean;
}

const ArmoryPanel: React.FC<ArmoryPanelProps> = ({ compact = false }) => {
  const bank = useProgression((s) => s.bank);
  const upgrades = useProgression((s) => s.upgrades);
  const purchase = useProgression((s) => s.purchase);

  const handleBuy = (id: PermUpgradeId) => {
    if (purchase(id)) {
      SoundManager.setVolume("upgradePurchase", 0.6);
      SoundManager.play("upgradePurchase");
    } else {
      SoundManager.setVolume("uiDenied", 0.5);
      SoundManager.play("uiDenied");
    }
  };

  return (
    <div className={`armory-panel ${compact ? "compact" : ""}`}>
      <div className="armory-header">
        <span className="armory-title">ARMORY</span>
        <span className="armory-bank">
          {formatSupply(bank)} <span className="armory-unit">SP banked</span>
        </span>
      </div>
      <div className="armory-grid">
        {PERM_UPGRADES.map((def) => {
          const level = upgrades[def.id];
          const maxed = level >= def.maxLevel;
          const cost = permUpgradeCost(def, level);
          const affordable = !maxed && bank >= cost;
          return (
            <button
              key={def.id}
              type="button"
              className={`armory-item ${maxed ? "maxed" : ""} ${
                affordable ? "affordable" : ""
              }`}
              onClick={() => handleBuy(def.id)}
              disabled={maxed}
              aria-label={`${def.name}, level ${level} of ${def.maxLevel}${
                maxed ? ", maxed" : `, costs ${cost} supply`
              }`}>
              <div className="armory-item-top">
                <span className="armory-item-name">{def.name}</span>
                <span className="armory-item-cost">
                  {maxed ? "MAX" : `${formatSupply(cost)} SP`}
                </span>
              </div>
              <div className="armory-item-effect">{def.perLevel}</div>
              <div className="armory-pips" aria-hidden="true">
                {Array.from({ length: def.maxLevel }, (_, i) => (
                  <span key={i} className={`pip ${i < level ? "filled" : ""}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ArmoryPanel;
