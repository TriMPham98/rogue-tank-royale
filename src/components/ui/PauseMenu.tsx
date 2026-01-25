// Pause Menu component
import React from "react";

interface PauseMenuProps {
  onResume: () => void;
  onMainMenu: () => void;
  onSettings: () => void;
}

const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onMainMenu,
  onSettings,
}) => {
  return (
    <div className="overlay pause-overlay">
      <div className="overlay-content pause-content">
        <h2 className="pause-title">OPERATION PAUSED</h2>
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
