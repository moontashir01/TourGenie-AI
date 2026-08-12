// Bangladesh and Thailand are the two core countries with deep destination
// coverage. The remaining supplementary countries retain their original
// gateway destination and can be promoted to a full pack later.
export const countries = [
  { code: "BD", name: "Bangladesh", capital: "Dhaka", currency: "BDT", currency_symbol: "৳", pricing_currency: "BDT", timezones: ["Asia/Dhaka"], languages: ["bn", "en"], primary_airport: "DAC", is_core: true },
  { code: "TH", name: "Thailand", capital: "Bangkok", currency: "THB", currency_symbol: "฿", pricing_currency: "BDT", timezones: ["Asia/Bangkok"], languages: ["th", "en"], primary_airport: "BKK", is_core: true },
];

export default countries;
