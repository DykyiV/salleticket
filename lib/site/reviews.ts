/**
 * Passenger reviews shown on the home page. The block stays hidden while
 * this list is empty. Add only real reviews, with the passenger's consent
 * (first name + initial is enough), e.g. copied from Google or Facebook.
 */
export type Review = {
  name: string;
  route: string;
  /** 1–5 */
  rating: number;
  text: string;
  /** YYYY-MM */
  date: string;
  lang: "uk" | "es" | "en";
};

export const REVIEWS: Review[] = [];
