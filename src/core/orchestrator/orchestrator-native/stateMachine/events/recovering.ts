export type RecoveringEvent = WANT_TO_RECOVER | WANT_TO_NOT_RECOVER;

export type WANT_TO_RECOVER = {
  type: "WANT_TO_RECOVER";
};

export type WANT_TO_NOT_RECOVER = {
  type: "WANT_TO_NOT_RECOVER";
};
