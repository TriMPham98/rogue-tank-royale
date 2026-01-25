// Warning Overlays component
import React from "react";

interface ContainmentWarningProps {
  show: boolean;
  opacity: number;
}

export const ContainmentWarning: React.FC<ContainmentWarningProps> = ({
  show,
  opacity,
}) => {
  if (!show) return null;

  return (
    <div
      className="warning-overlay containment-warning"
      style={{ "--opacity": opacity } as React.CSSProperties}>
      <div className="warning-icon">☢️</div>
      <div className="warning-text">
        <div>Combat Zone shrinking</div>
      </div>
      <div className="warning-icon">☢️</div>
    </div>
  );
};

interface OutsideZoneWarningProps {
  show: boolean;
  opacity: number;
}

export const OutsideZoneWarning: React.FC<OutsideZoneWarningProps> = ({
  show,
  opacity,
}) => {
  if (!show) return null;

  return (
    <div
      className="warning-overlay outside-zone-warning"
      style={{ "--opacity": opacity } as React.CSSProperties}>
      <div className="warning-icon">🚨</div>
      <div className="warning-text">WARNING: ZONE DAMAGE</div>
      <div className="warning-icon">🚨</div>
    </div>
  );
};

interface CombatZoneShrinkWarningProps {
  show: boolean;
}

export const CombatZoneShrinkWarning: React.FC<CombatZoneShrinkWarningProps> = ({
  show,
}) => {
  if (!show) return null;

  return (
    <div className="combat-zone-warning">Combat zone is shrinking!</div>
  );
};

interface OrientationWarningProps {
  show: boolean;
  onDismiss: () => void;
}

export const OrientationWarning: React.FC<OrientationWarningProps> = ({
  show,
  onDismiss,
}) => {
  if (!show) return null;

  return (
    <div className="orientation-warning-overlay">
      <div className="orientation-warning-content">
        <div className="warning-header">
          <div className="warning-icon">!</div>
          ALERT: DEVICE ORIENTATION
        </div>
        <div className="warning-message">ROTATE DEVICE TO LANDSCAPE MODE</div>
        <div className="warning-detail">
          Combat systems require landscape orientation for optimal operation
        </div>
        <button className="dismiss-button" onClick={onDismiss}>
          DISMISS WARNING
        </button>
      </div>
    </div>
  );
};
