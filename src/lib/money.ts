/** Prices on Rollshot: $0 is a free portfolio shoot or unpaid crew job, so it reads "Free". */
export const money = (n: number | null | undefined) => (n === 0 ? "Free" : n == null ? "" : `$${n}`);
