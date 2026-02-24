export const ratio = (val, min, max) => {
    if (min === max) {
        return val >= max ? 1 : 0;
    }
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
}
