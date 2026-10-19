const UNITS = [
  "",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];

const TENS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];

const HUNDREDS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

function underThousand(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const parts: string[] = [];
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (hundred) parts.push(HUNDREDS[hundred]);
  if (rest) {
    if (rest < 20) parts.push(UNITS[rest]);
    else {
      const ten = Math.floor(rest / 10);
      const unit = rest % 10;
      parts.push(unit ? `${TENS[ten]} e ${UNITS[unit]}` : TENS[ten]);
    }
  }
  return parts.join(" e ");
}

function integerWords(value: number): string {
  if (value === 0) return "zero";
  const groups: { text: string; n: number }[] = [];
  const scales: { value: number; singular: string; plural: string }[] = [
    { value: 1_000_000_000, singular: "bilhão", plural: "bilhões" },
    { value: 1_000_000, singular: "milhão", plural: "milhões" },
  ];
  let rest = value;
  for (const scale of scales) {
    const qty = Math.floor(rest / scale.value);
    if (!qty) continue;
    rest -= qty * scale.value;
    const label = qty === 1 ? scale.singular : scale.plural;
    groups.push({ text: `${underThousand(qty)} ${label}`, n: qty * scale.value });
  }
  const thousands = Math.floor(rest / 1000);
  if (thousands) {
    rest -= thousands * 1000;
    groups.push({
      text: thousands === 1 ? "mil" : `${underThousand(thousands)} mil`,
      n: thousands * 1000,
    });
  }
  if (rest) groups.push({ text: underThousand(rest), n: rest });

  return groups.reduce((acc, group, index) => {
    if (index === 0) return group.text;
    const withE = group.n < 100 || group.n % 100 === 0;
    return `${acc}${withE ? " e " : " "}${group.text}`;
  }, "");
}

const MAX_CENTS = 999_999_999_99;

export function valorPorExtenso(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0 || cents > MAX_CENTS) {
    throw new Error("Valor inválido para conversão por extenso.");
  }
  if (cents === 0) return "Zero real";

  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  const parts: string[] = [];

  if (reais > 0) {
    const words = integerWords(reais);
    const de = reais % 1_000_000 === 0 && reais >= 1_000_000 ? "de " : "";
    parts.push(`${words} ${de}${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) {
    const words = integerWords(centavos);
    parts.push(`${words} ${centavos === 1 ? "centavo" : "centavos"}`);
  }

  const sentence = parts.join(" e ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function sumPrices(cents: number[], discountCents = 0): number {
  const total = cents.reduce((acc, value) => acc + value, 0) - discountCents;
  if (total < 0) throw new Error("O desconto não pode superar a soma dos itens.");
  return total;
}
