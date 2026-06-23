/* Blank PDF loader.
   We import each blank with Vite's "?url" so the build bundles the PDF and
   gives us its final web address. This means the PDFs can sit right here at the
   project root — no /public/blanks folder needed. To add a new blank, drop the
   PDF here and add one import + one line below, matching the form key. */
import G1450 from "./G-1450.pdf?url";
import I130 from "./I-130.pdf?url";
import I130A from "./I-130A.pdf?url";
import I131 from "./I-131.pdf?url";
import I485 from "./I-485.pdf?url";
import I693 from "./I-693.pdf?url";
import I765 from "./I-765.pdf?url";
import I864 from "./I-864.pdf?url";
import N400 from "./N-400.pdf?url";
import N600 from "./N-600.pdf?url";

// To enable I-90 / I-751 / I-129F: drop the blank here, then uncomment its line.
import I90 from "./I-90.pdf?url";
import I751 from "./I-751.pdf?url";
import I129F from "./I-129F.pdf?url";

export const BLANK_URLS = {
  "G-1450": G1450,
  "I-130": I130,
  "I-130A": I130A,
  "I-131": I131,
  "I-485": I485,
  "I-693": I693,
  "I-765": I765,
  "I-864": I864,
  "N-400": N400,
  "N-600": N600,
  "I-90": I90,
  "I-751": I751,
  "I-129F": I129F,
};
