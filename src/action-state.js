const ACTIVE_ICONS = {
  16: "assets/icons/icon-16.png",
  32: "assets/icons/icon-32.png",
};

const PAUSED_ICONS = {
  16: "assets/icons/icon-paused-16.png",
  32: "assets/icons/icon-paused-32.png",
};

export function createActionState(masterEnabled) {
  return {
    badgeText: "",
    icon: masterEnabled ? ACTIVE_ICONS : PAUSED_ICONS,
  };
}
