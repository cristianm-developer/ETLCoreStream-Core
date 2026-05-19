export const stopAction = ({ self }: { self: { stop: () => void } }) => {
  self.stop();
};
