// PathFile in-browser PDF filler — faithful JS port of fill_uscis_forms.py.
// Works in the browser (Vite) and in Node. pdf-lib does the actual filling.
import { PDFDocument, PDFName, PDFBool, StandardFonts } from 'pdf-lib';
// Blank-PDF file names come from the central registry so they never drift.
import { PDF_FILES } from './formsRegistry.js';

export { PDF_FILES };

/* ---------- helpers ---------- */
const mmddyyyy = (iso) => {
  if (!iso) return "";
  const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : String(iso);
};
const anum = (v) => (v ? String(v).replace(/\D/g, "") : "");
const hdate = (v) => {
  if (!v) return "";
  if (/^(present|current|now)$/i.test(String(v).trim())) return "PRESENT";
  return mmddyyyy(v);
};

/* ---------- identity block (build_maps) ----------
   Each form has its own small array below. A row is:
       ["<box name ending>", <page number>, <value to type>]
   To ADD a new form: make a new array (copy N400), then add it to the
   returned object at the bottom. The box-name endings come from
   scripts/extract_fields.mjs. See HOW_TO_ADD_OR_UPDATE_A_FORM.md. */
function buildMaps(d) {
  const g = (k) => d[k];
  const I130 = [
    ["Pt2Line4a_FamilyName[0]",1,g("p_last")],["Pt2Line4b_GivenName[0]",1,g("p_first")],
    ["Pt2Line4c_MiddleName[0]",1,g("p_middle")],["Pt2Line1_AlienNumber[0]",1,anum(g("p_anum"))],
    ["Pt2Line11_SSN[0]",1,g("p_ssn")],["Pt2Line8_DateofBirth[0]",2,mmddyyyy(g("p_dob"))],
    ["Pt2Line12_StreetNumberName[0]",2,g("p_street")],["Pt2Line12_CityOrTown[0]",2,g("p_city")],
    ["Pt2Line12_State[0]",2,g("p_state")],["Pt2Line12_ZipCode[0]",2,g("p_zip")],
    ["Pt4Line4a_FamilyName[0]",5,g("s_last")],["Pt4Line4b_GivenName[0]",5,g("s_first")],
    ["Pt4Line4c_MiddleName[0]",5,g("s_middle")],["Pt4Line3_SSN[0]",5,g("s_ssn")],
    ["Pt4Line8_CountryOfBirth[0]",5,g("s_cob")],["Pt4Line9_DateOfBirth[0]",5,mmddyyyy(g("s_dob"))],
  ];
  const I765 = [
    ["Line1a_FamilyName[0]",1,g("s_last")],["Line1b_GivenName[0]",1,g("s_first")],
    ["Line1c_MiddleName[0]",1,g("s_middle")],["Line7_AlienNumber[0]",2,anum(g("s_anum"))],
    ["Line12b_SSN[0]",2,g("s_ssn")],["Line4b_StreetNumberName[0]",2,g("s_street")],
    ["Pt2Line5_CityOrTown[0]",2,g("s_city")],["Pt2Line5_State[0]",2,g("s_state")],
    ["Pt2Line5_ZipCode[0]",2,g("s_zip")],
    ["Line20a_I94Number[0]",3,g("e_i94")],["Line20b_Passport[0]",3,g("e_passport")],
    ["Line20d_CountryOfIssuance[0]",3,g("e_passcountry")],["Line21_DateOfLastEntry[0]",3,mmddyyyy(g("e_lastentry"))],
    ["place_entry[0]",3,g("e_place")],["Line23_StatusLastEntry[0]",3,g("e_status")],
    ["Line24_CurrentStatus[0]",3,g("e_curstatus")],
  ];
  const N600 = [
    ["Pt1Line1_FamilyName[0]",1,g("s_last")],["Pt1Line1_GivenName[0]",1,g("s_first")],
    ["Pt1Line1_MiddleName[0]",1,g("s_middle")],["Line1_AlienNumber[0]",1,anum(g("s_anum"))],
    ["P2_Line8_DateOfBirth[0]",2,mmddyyyy(g("s_dob"))],["P2_Line10_CountryOfBirth[0]",2,g("s_cob")],
  ];
  // ---- N-400: comprehensive map ----
  const nm = (d.s_marital || "");
  const nb = (d.n_basis || "");
  const nsex = (d.s_sex || "").toLowerCase();
  const eligBox = nb.startsWith("3 years") ? "Part1_Eligibility[1]"
    : nb.startsWith("Military") ? "Part1_Eligibility[4]"
    : "Part1_Eligibility[2]";
  const maritalBox = { Single: "[1]", Married: "[3]", Divorced: "[0]", Widowed: "[2]", Annulled: "[4]", Separated: "[5]" }[nm];
  const ethBox = (d.s_ethnicity || "").startsWith("Hispanic") ? "P7_Line1_Ethnicity[1]" : "P7_Line1_Ethnicity[0]";
  const raceBox = { "White":"[4]", "Black or African American":"[2]", "Asian":"[1]", "American Indian or Alaska Native":"[0]", "Native Hawaiian or Other Pacific Islander":"[3]" }[d.s_race];
  const eyeBox = { "Brown":"[0]","Blue":"[1]","Green":"[2]","Hazel":"[3]","Gray":"[4]","Black":"[5]","Pink":"[6]","Maroon":"[7]","Unknown/Other":"[8]" }[d.s_eye];
  const hairBox = { "Bald (No hair)":"[0]","Sandy":"[1]","Red":"[2]","White":"[3]","Gray":"[4]","Blond":"[5]","Brown":"[6]","Black":"[7]","Unknown/Other":"[8]" }[d.s_hair];
  const wt = String(d.s_weight || "").replace(/\D/g, "");
  const wt3 = wt ? wt.padStart(3, " ") : "";
  // Part 9 gates (clean answer applies unless the person flagged the issue)
  const okClaim = d.s_claimcit !== "Yes";
  const okTax = d.s_taxes !== "Yes";
  const okBad = d.s_badacts !== "Yes";
  const okCrime = d.s_crime !== "Yes" && d.crim !== "yes";
  const okImm = d.s_immfraud !== "Yes";
  const okRem = d.s_removal !== "Yes" && d.removal !== "yes";
  const willing = d.s_oath !== "No";
  const ck = [];
  const C = (f, p) => ck.push([f, p, "X"]);
  if (okClaim) { C("P9_Line1[0]",6); C("P9_Line2[0]",6); }
  if (okTax) { C("P9_Line3[1]",6); C("P9_Line4[1]",6); }
  if (okBad) { ["P9_5a[1]","P9_5b[1]"].forEach((f)=>C(f,6));
    ["P12_6a[0]","P12_6b[1]","P12_6c[0]","P9_Line7a[0]","P11_7d[0]","P9_Line8a[0]","P9_Line8b[0]","P9_Line9[0]","P9_Line10a[0]","P9_Line10b[0]","P9_Line10c[1]","P9_Line11[0]","P9_Line12[0]","P9_Line13[0]","P9_Line14[0]"].forEach((f)=>C(f,7)); }
  if (okCrime) { ["P9_Line15a[0]","P9_Line15b[0]"].forEach((f)=>C(f,8)); }
  if (okImm) { ["P11_Line17A[0]","P11_Line17B[0]","P11_Line17C[0]","P12_Line17d[0]","P12_Line17e[0]","P12_Line17f[1]","P12_Line17g[0]","P12_Line17h[0]","P12_Line18[1]","P12_Line19[1]"].forEach((f)=>C(f,9)); }
  if (okRem) { ["P12_Line20[0]","P12_Line21[0]"].forEach((f)=>C(f,9)); }
  ["P12_Line23[0]","P12_Line24[0]","P12_Line25[0]"].forEach((f)=>C(f,9));
  ["P12_Line26a[0]","P12_Line26b[0]","P12_Line26c[0]","P12_Line27[1]","P12_Line28[1]","P12_Line30a[1]"].forEach((f)=>C(f,10));
  if (willing) ["P12_Line31[1]","P12_Line32[0]","P12_Line33[1]","P12_Line34[1]","P12_Line35[0]","P12_Line36[1]","P12_Line37[0]"].forEach((f)=>C(f,10));
  // Selective Service (men only)
  if (nsex==="male" && d.s_ss_lived==="Yes") { C("P9_Line22a[1]",9); ck.push(["Pt9_Line22b"+(d.s_ss_registered==="No"?"[0]":"[1]"),9,"X"]); }
  else if (nsex==="female") C("P9_Line22a[0]",9);
  const N400 = [
    [eligBox, 1, "X"],
    ["P2_Line1_FamilyName[0]",1,g("s_last")],["P2_Line1_GivenName[0]",1,g("s_first")],["P2_Line1_MiddleName[0]",1,g("s_middle")],
    ["Line2_FamilyName1[0]",1,g("s_other")],
    ["Line1_AlienNumber[0]",1,anum(g("s_anum"))],
    [nsex==="female"?"P2_Line7_Gender[1]":"P2_Line7_Gender[0]",2,"X"],
    ["P2_Line8_DateOfBirth[0]",2,mmddyyyy(g("s_dob"))],
    ["P2_Line9_DateBecamePermanentResident[0]",2,mmddyyyy(g("s_lprdate"))],
    ["P2_Line10_CountryOfBirth[0]",2,g("s_cob")],["P2_Line11_CountryOfNationality[0]",2,g("s_coc")],
    ["Line12b_SSN[0]",2,anum(g("s_ssn"))],
    ["P2_Line34_NameChange[0]",2,"X"],["P2_Line10_claimdisability[0]",2,"X"],
    ["P2_Line11_claimdisability[0]",2,"X"],["Line12a_Checkbox[0]",2,"X"],
    // Part 3 — biographic
    [ethBox,3,"X"],
    ...(raceBox ? [["P7_Line2_Race"+raceBox,3,"X"]] : []),
    ["P7_Line3_HeightFeet[0]",3,g("s_height_ft")],["P7_Line3_HeightInches[0]",3,g("s_height_in")],
    ...(wt3 ? [["P7_Line4_Pounds1[0]",3,wt3[0].trim()],["P7_Line4_Pounds2[0]",3,wt3[1].trim()],["P7_Line4_Pounds3[0]",3,wt3[2]]] : []),
    ...(eyeBox ? [["P7_Line5_Eye"+eyeBox,3,"X"]] : []),
    ...(hairBox ? [["P7_Line6_Hair"+hairBox,3,"X"]] : []),
    // Part 4 — current address + dates + mailing-same
    ["P4_Line1_StreetName[0]",3,g("s_street")],["P4_Line1_City[0]",3,g("s_city")],
    ["P4_Line1_State[0]",3,g("s_state")],["P4_Line1_ZipCode[0]",3,g("s_zip")],
    ["P4_Line1_DatesofResidence[0]",3,mmddyyyy(g("s_movein"))],
    [(d.s_mailsame||"").startsWith("No") ? "Pt3_Line2a_Checkbox[0]" : "Pt3_Line2a_Checkbox[1]",3,"X"],
    // Part 5 — marital + spouse
    ...(maritalBox ? [["P10_Line1_MaritalStatus"+maritalBox,4,"X"]] : []),
    ...(nm==="Married" ? [
      ["P10_Line4a_FamilyName[0]",4,g("sp_last")],["P10_Line4a_GivenName[0]",4,g("sp_first")],
      ["P10_Line4a_MiddleName[0]",4,g("sp_middle")],["P10_Line4d_DateofBirth[0]",4,mmddyyyy(g("sp_dob"))],
      ["P7_Line2_Forces[0]",4,"X"],
    ] : []),
    // Part 6 — children count
    ["P11_Line1_TotalChildren[0]",5,g("s_children")],
    // Part 7 — current employment
    ["P7_EmployerName1[0]",5,g("s_employer")],["P7_OccupationFieldStudy1[0]",5,g("s_occupation")],
    ["P7_City1[0]",5,g("s_emp_city")],["P7_State1[0]",5,g("s_emp_state")],
    ["P7_ZipCode1[0]",5,g("s_emp_zip")],["P7_From1[0]",5,mmddyyyy(g("s_emp_from"))],
    ...(g("s_emp_city") ? [["P7_Country1[0]",5,"United States"]] : []),
    // Part 11 — contact
    ["P12_Line3_Telephone[0]",11,g("s_phone")],["P12_Line5_Email[0]",11,g("s_email")],
    ...ck,
  ];
  const I130A = [
    ["Pt1Line3a_FamilyName[0]",1,g("s_last")],["Pt1Line3b_GivenName[0]",1,g("s_first")],
    ["Pt1Line3c_MiddleName[0]",1,g("s_middle")],["Pt1Line1_AlienNumber[0]",1,anum(g("s_anum"))],
    ["Pt1Line4a_StreetNumberName[0]",1,g("s_street")],["Pt1Line4c_CityOrTown[0]",1,g("s_city")],
    ["Pt1Line4d_State[0]",1,g("s_state")],["Pt1Line4e_ZipCode[0]",1,g("s_zip")],
  ];
  const I864 = [
    ["P4_Line1a_FamilyName[0]",1,g("p_last")],["P4_Line1b_GivenName[0]",1,g("p_first")],
    ["P4_Line1c_MiddleName[0]",1,g("p_middle")],["P4_Line12_AlienNumber[0]",2,anum(g("p_anum"))],
    ["P4_Line2b_StreetNumberName[0]",2,g("p_street")],["P4_Line2e_CityOrTown[0]",2,g("p_city")],
    ["P4_Line2f_State[0]",2,g("p_state")],["P4_Line2g_ZipCode[0]",2,g("p_zip")],
    ["P4_Line6_DateOfBirth[0]",2,mmddyyyy(g("p_dob"))],
    ["P2_Line1a_FamilyName[0]",3,g("s_last")],["P2_Line1b_GivenName[0]",3,g("s_first")],
    ["P2_Line1c_MiddleName[0]",3,g("s_middle")],
    ["P3_Line28_TotalNumberofImmigrants[0]",5,g("num_immigrants")||"1"],
    ["P5_Line2_Yourself[0]",5,"1"],["P5_Line4_DependentChildren[0]",5,g("hh_children")],
    ["P5_Line5_OtherDependents[0]",5,g("hh_other")],["P6_Line2_TotalIncome[0]",5,g("p_income")],
  ];
  const I131 = [
    ["Part2_Line2_FamilyName1[0]",5,g("s_last")],["Part2_Line2_GivenName1[0]",5,g("s_first")],
    ["Part2_Line2_MiddleName1[0]",5,g("s_middle")],["Part2_Line5_AlienNumber[0]",5,anum(g("s_anum"))],
    ["Part2_Line10_SSN[0]",5,g("s_ssn")],["Part2_Line3_StreetNumberName[0]",5,g("s_street")],
    ["Part2_Line3_CityTown[0]",5,g("s_city")],["Part2_Line3_State[0]",5,g("s_state")],
    ["Part2_Line3_ZipCode[0]",5,g("s_zip")],["Part2_Line6_CountryOfBirth[0]",5,g("s_cob")],
    ["Part2_Line7_CountryOfCitizenshiporNationality[0]",5,g("s_coc")],
    ["Part2_Line9_DateOfBirth[0]",5,mmddyyyy(g("s_dob"))],
  ];
  const I693 = [
    ["Pt1Line1a_FamilyName[0]",1,g("s_last")],["Pt1Line1b_GivenName[0]",1,g("s_first")],
    ["Pt1Line1c_MiddleName[0]",1,g("s_middle")],["Pt1Line3e_AlienNumber[0]",1,anum(g("s_anum"))],
    ["Pt1Line3_DateOfBirth[0]",1,mmddyyyy(g("s_dob"))],["Pt1Line3_CountryofBirth[0]",1,g("s_cob")],
    ["Pt1Line2_StreetNumberName[0]",1,g("s_street")],["P1Line2_CityOrTown[0]",1,g("s_city")],
    ["P1Line2_State[0]",1,g("s_state")],["P1Line2_ZipCode[0]",1,g("s_zip")],
  ];
  const I485 = [
    ["Pt1Line1_FamilyName[0]",1,g("s_last")],["Pt1Line1_GivenName[0]",1,g("s_first")],
    ["Pt1Line1_MiddleName[0]",1,g("s_middle")],["AlienNumber[0]",1,anum(g("s_anum"))],
    ["Pt1Line3_DOB[0]",1,mmddyyyy(g("s_dob"))],["Pt1Line7_CountryOfBirth[0]",2,g("s_cob")],
    ["Pt1Line8_CountryofCitizenshipNationality[0]",2,g("s_coc")],
    ["Pt1Line9_USCISAccountNumber[0]",2,g("s_uscis")],["Pt1Line10_PassportNum[0]",2,g("e_passport")],
    ["Pt1Line10_DateofArrival[0]",2,mmddyyyy(g("e_lastentry"))],["Pt1Line10_CityTown[0]",2,g("e_place")],
    ["P1Line12_I94[0]",3,g("e_i94")],["Pt1Line12_Status[0]",3,g("e_status")],
    ["Pt1Line14_Status[0]",3,g("e_curstatus")],
  ];
  const G1450 = [
    ["CCHolderFamilyName[0]",1,g("cc_last")||g("p_last")],["CCHolderGivenName[0]",1,g("cc_first")||g("p_first")],
    ["CCHolderMiddleName[0]",1,g("cc_middle")||g("p_middle")],
    ["Pt1Line2b_StreetNumberName[0]",1,g("cc_street")||g("p_street")],
    ["CityOrTown[0]",1,g("cc_city")||g("p_city")],["State[0]",1,g("cc_state")||g("p_state")],
    ["ZipCode[0]",1,g("cc_zip")||g("p_zip")],["DaytimeTelephoneNumber[0]",1,g("cc_phone")||g("p_phone")],
    ["Email[0]",1,g("cc_email")||g("p_email")],
  ];
  /* ---- NEW FORMS — real field maps (verified against the official blanks) ---- */
  const I90 = [
    ["P1_Line1_AlienNumber[0]",1,anum(g("s_anum"))],
    ["P1_Line3a_FamilyName[0]",1,g("s_last")],["P1_Line3b_GivenName[0]",1,g("s_first")],
    ["P1_Line3c_MiddleName[0]",1,g("s_middle")],
    ["P1_Line6b_StreetNumberName[0]",1,g("s_street")],["P1_Line6d_CityOrTown[0]",1,g("s_city")],
    ["P1_Line6e_State[0]",1,g("s_state")],["P1_Line6f_ZipCode[0]",1,g("s_zip")],
    ["P1_Line9_DateOfBirth[0]",2,mmddyyyy(g("s_dob"))],
    ["P1_Line11_CountryofBirth[0]",2,g("s_cob")],["P1_Line16_SSN[0]",2,g("s_ssn")],
  ];
  const I751 = [
    ["Pt1Line1a_FamilyName[0]",1,g("s_last")],["Pt1Line1b_GivenName[0]",1,g("s_first")],
    ["Pt1Line1c_MiddleName[0]",1,g("s_middle")],
    ["P1_Line4_DateOfBirth[0]",1,mmddyyyy(g("s_dob"))],["P1_Line5_CountryOfBirth[0]",1,g("s_cob")],
    ["P1_Line6_CountryOfCitizenship[0]",1,g("s_coc")||g("s_cob")],
    ["P1_Line7_AlienNumber[0]",1,anum(g("s_anum"))],["P1_Line8_SSN[0]",1,g("s_ssn")],
    ["Pt1Line15e_State[0]",2,g("s_state")],["Pt1Line15f_ZipCode[0]",2,g("s_zip")],
  ];
  const I129F = [
    ["Pt1Line1_AlienNumber[0]",1,anum(g("s_anum"))],
    ["Pt1Line6a_FamilyName[0]",1,g("s_last")],["Pt1Line6b_GivenName[0]",1,g("s_first")],
    ["Pt1Line6c_MiddleName[0]",1,g("s_middle")],
    ["Pt1Line8_StreetNumberName[0]",1,g("s_street")],["Pt1Line8_CityOrTown[0]",1,g("s_city")],
    ["Pt1Line8_State[0]",1,g("s_state")],["Pt1Line8_ZipCode[0]",1,g("s_zip")],
    ["Pt1Line22_DateofBirth[0]",3,mmddyyyy(g("s_dob"))],
  ];
  return {"N-400":N400,"N-600":N600,"I-130":I130,"I-130A":I130A,"I-765":I765,
          "I-864":I864,"I-131":I131,"I-693":I693,"I-485":I485,"G-1450":G1450,
          "I-90":I90,"I-751":I751,"I-129F":I129F};
}

/* ---------- deterministic path fields (path_maps) ---------- */
function pathMaps(d) {
  const g = (k) => d[k];
  const out = {}; for (const c in PDF_FILES) out[c] = [];
  if (g("filing_path") === "marriage_aos") {
    out["I-130"].push(
      ["Pt1Line1_Spouse[0]",1,"/Y"],
      ["Pt2Line18_DateOfMarriage[0]",3,mmddyyyy(g("m_date"))],
      ["Pt2Line19a_CityTown[0]",3,g("m_city")],["Pt2Line19b_State[0]",3,g("m_state")],
      ["Pt2Line19d_Country[0]",3,g("m_country")],["PtLine20a_FamilyName[0]",3,g("s_last")],
      ["Pt2Line20b_GivenName[0]",3,g("s_first")],["Pt2Line20c_MiddleName[0]",3,g("s_middle")],
    );
    if (g("p_citizen") === "us_citizen") out["I-130"].push(["Pt2Line36_USCitizen[0]",3,"/Y"]);
    out["I-765"].push(["section_1[0]",3,"c"],["section_2[0]",3,"9"]);
    out["I-485"].push(["Pt2Line2_CB[0]",5,"/1fA"],["Pt2Line3a_CB[0]",5,"/3a0"]);
  }
  return out;
}

/* ---------- repeating history (history_maps) ---------- */
function historyMaps(d) {
  const out = {}; for (const c in PDF_FILES) out[c] = [];
  const addr = d.address_history || [], emp = d.employment_history || [];
  const a0 = addr[0], a1 = addr[1];
  // I-485 address
  if (a0) out["I-485"].push(
    ["Pt1Line18_StreetNumberName[0]",3,a0.street],["Pt1Line18US_AptSteFlrNumber[0]",3,a0.apt],
    ["Pt1Line18_CityOrTown[0]",3,a0.city],["Pt1Line18_State[0]",3,a0.state],
    ["Pt1Line18_ZipCode[0]",3,a0.zip],["Pt1Line18_Date[0]",3,hdate(a0.from)]);
  if (a1) out["I-485"].push(
    ["Pt1Line18_PriorStreetName[0]",4,a1.street],["Pt1Line18_PriorAddress_Number[0]",4,a1.apt],
    ["Pt1Line18_PriorCity[0]",4,a1.city],["Pt1Line18_PriorState[0]",4,a1.state],
    ["Pt1Line18_PriorZipCode[0]",4,a1.zip],["Pt1Line18_PriorDateFrom[0]",4,hdate(a1.from)],
    ["Pt1Line18PriorDateTo[0]",4,hdate(a1.to)]);
  // I-485 employment
  const e0 = emp[0], e1 = emp[1];
  if (e0) out["I-485"].push(
    ["Pt4Line7_EmployerName[0]",8,e0.employer],["Pt4Line7_EmployerName[2]",8,e0.employer],
    ["Pt4Line7_EmployerName[1]",8,e0.occupation],["Part4Line7_StreetName[0]",9,e0.emp_street],
    ["P4Line7_Number[0]",9,e0.emp_apt],["P4Line7_City[0]",9,e0.emp_city],
    ["P4Line7_State[0]",9,e0.emp_state],["P4Line7_ZipCode[0]",9,e0.emp_zip],
    ["Pt4Line7_DateFrom[0]",9,hdate(e0.from)],["Pt4Line7_DateTo[0]",9,hdate(e0.to)]);
  if (e1) out["I-485"].push(
    ["Pt4Line8_EmployerName[0]",9,e1.employer],["Pt4Line8_Occupation[0]",9,e1.occupation],
    ["P4Line8_StreetName[0]",9,e1.emp_street],["P4Line8_Number[0]",9,e1.emp_apt],
    ["P4Line8_City[0]",9,e1.emp_city],["P4Line8_State[0]",9,e1.emp_state],
    ["P4Line8_ZipCode[0]",9,e1.emp_zip],["Pt4Line8_DateFrom[0]",9,hdate(e1.from)],
    ["Pt4Line8_DateTo[0]",9,hdate(e1.to)]);
  // I-130A address (2 slots) + employment (3 slots)
  if (a0) out["I-130A"].push(
    ["Pt1Line4a_StreetNumberName[0]",1,a0.street],["Pt1Line4b_AptSteFlrNumber[0]",1,a0.apt],
    ["Pt1Line4c_CityOrTown[0]",1,a0.city],["Pt1Line4d_State[0]",1,a0.state],
    ["Pt1Line4e_ZipCode[0]",1,a0.zip],["Pt1Line5a_DateFrom[0]",1,hdate(a0.from)],
    ["Pt1Line5b_DateTo[0]",1,hdate(a0.to)]);
  if (a1) out["I-130A"].push(
    ["Pt1Line6a_StreetNumberName[0]",1,a1.street],["Pt1Line6b_AptSteFlrNumber[0]",1,a1.apt],
    ["Pt1Line6c_CityOrTown[0]",1,a1.city],["Pt1Line6d_State[0]",1,a1.state],
    ["Pt1Line6e_ZipCode[0]",1,a1.zip],["Pt1Line7a_DateFrom[0]",1,hdate(a1.from)],
    ["Pt1Line7b_DateTo[0]",1,hdate(a1.to)]);
  const A130_unused = null;
  if (emp[0]) { const e=emp[0]; out["I-130A"].push(
    ["Pt2Line1_EmployerOrCompName[0]",2,e.employer],["Pt2Line2a_StreetNumberName[0]",2,e.emp_street],
    ["Pt2Line2c_CityOrTown[0]",2,e.emp_city],["Pt2Line2d_State[0]",2,e.emp_state],
    ["Pt2Line2e_ZipCode[0]",2,e.emp_zip],["Pt2Line3_Occupation[0]",2,e.occupation],
    ["Pt2Line4a_DateFrom[0]",2,hdate(e.from)],["Pt2Line4b_DateTo[0]",2,hdate(e.to)]); }
  if (emp[1]) { const e=emp[1]; out["I-130A"].push(
    ["Pt2Line5_EmployerOrCompName[0]",2,e.employer],["Pt2Line6_StreetNumberName[0]",2,e.emp_street],
    ["Pt2Line6_CityOrTown[0]",2,e.emp_city],["Pt2Line6_State[0]",2,e.emp_state],
    ["Pt2Line6_ZipCode[0]",2,e.emp_zip],["Pt2Line7_Occupation[0]",3,e.occupation],
    ["Pt2Line8a_DateFrom[0]",3,hdate(e.from)],["Pt2Line8b_DateTo[0]",3,hdate(e.to)]); }
  if (emp[2]) { const e=emp[2]; out["I-130A"].push(
    ["Pt3Line1_EmployerOrCompName[0]",3,e.employer],["Pt3Line2a_StreetNumberName[0]",3,e.emp_street],
    ["Pt3Line2c_CityOrTown[0]",3,e.emp_city],["Pt3Line2d_State[0]",3,e.emp_state],
    ["Pt3Line2e_ZipCode[0]",3,e.emp_zip],["Pt3Line3_Occupation[0]",3,e.occupation],
    ["Pt3Line4a_DateFrom[0]",3,hdate(e.from)],["Pt3Line4b_DateTo[0]",3,hdate(e.to)]); }
  // I-130 petitioner history
  const pa = d.p_prior_addresses || [], pe = d.p_employment_history || [];
  if (d.p_addr_from) out["I-130"].push(["Pt2Line13a_DateFrom[0]",2,hdate(d.p_addr_from)],["Pt2Line13b_DateTo[0]",2,"PRESENT"]);
  if (pa[0]) { const a=pa[0]; out["I-130"].push(
    ["Pt2Line14_StreetNumberName[0]",2,a.street],["Pt2Line14_AptSteFlrNumber[0]",2,a.apt],
    ["Pt2Line14_CityOrTown[0]",2,a.city],["Pt2Line14_State[0]",2,a.state],
    ["Pt2Line14_ZipCode[0]",2,a.zip],["Pt2Line15a_DateFrom[0]",2,hdate(a.from)],
    ["Pt2Line15b_DateTo[0]",2,hdate(a.to)]); }
  if (pe[0]) { const e=pe[0]; out["I-130"].push(
    ["Pt2Line40_EmployerOrCompName[0]",4,e.employer],["Pt2Line41_StreetNumberName[0]",4,e.emp_street],
    ["Pt2Line41_AptSteFlrNumber[0]",4,e.emp_apt],["Pt2Line41_CityOrTown[0]",4,e.emp_city],
    ["Pt2Line41_State[0]",4,e.emp_state],["Pt2Line41_ZipCode[0]",4,e.emp_zip],
    ["Pt2Line42_Occupation[0]",4,e.occupation],["Pt2Line43a_DateFrom[0]",4,hdate(e.from)],
    ["Pt2Line43b_DateTo[0]",4,hdate(e.to)]); }
  if (pe[1]) { const e=pe[1]; out["I-130"].push(
    ["Pt2Line44_EmployerOrOrgName[0]",4,e.employer],["Pt2Line45_StreetNumberName[0]",4,e.emp_street],
    ["Pt2Line45_AptSteFlrNumber[0]",4,e.emp_apt],["Pt2Line45_CityOrTown[0]",4,e.emp_city],
    ["Pt2Line45_State[0]",4,e.emp_state],["Pt2Line45_ZipCode[0]",4,e.emp_zip],
    ["Pt2Line46_Occupation[0]",4,e.occupation],["Pt2Line47a_DateFrom[0]",4,hdate(e.from)],
    ["Pt2Line47b_DateTo[0]",4,hdate(e.to)]); }
  return out;
}

export const DO_NOT_FILL = ["Pt2Line11_CB", "_YN["];

export function screenReferral(d) {
  const reasons = [];
  const fam = true; // app only reaches the filler for family cases; keep parity
  const entry = d.entry || d.rel_entry;
  if (d.filing_path === "marriage_aos" && (entry === "no" || entry === "unsure" || entry === "ewi"))
    reasons.push("Entry without inspection / unconfirmed — needs counsel");
  if (d.removal === "yes" || d.removal === "unsure") reasons.push("Prior removal or open immigration case");
  if (d.crim === "yes" || d.crim === "unsure") reasons.push("Arrest/charge/conviction history");
  return reasons;
}

/* ---------- resolve + fill ---------- */
function resolve(indexRows, suffix, page) {
  let hit = indexRows.find(([id, pg]) => pg === page && id.endsWith(suffix));
  if (!hit) hit = indexRows.find(([id]) => id.endsWith(suffix));
  return hit || null; // [id, page, type, on]
}

export async function fillForm(code, data, blankBytes, fieldIndex) {
  const rows = [...buildMaps(data)[code], ...pathMaps(data)[code], ...historyMaps(data)[code]];
  const indexRows = fieldIndex[code];
  const doc = await PDFDocument.load(blankBytes, { throwOnInvalidObject: false, updateMetadata: false, ignoreEncryption: true });
  const form = doc.getForm();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  let filled = 0;
  for (const [suffix, page, value] of rows) {
    if (DO_NOT_FILL.some((g) => suffix.includes(g))) continue;
    if (value === null || value === undefined || String(value).trim() === "") continue;
    const hit = resolve(indexRows, suffix, page);
    if (!hit) continue;
    const [fid, , type] = hit;
    try {
      if (type === "c" || type === "r") { form.getCheckBox(fid).check(); filled++; }
      else if (type === "h") {
        try { const dd = form.getDropdown(fid); dd.select(String(value)); dd.updateAppearances(helv); filled++; }
        catch { try { form.getTextField(fid).setText(String(value)); filled++; } catch {} }
      } else { form.getTextField(fid).setText(String(value)); filled++; }
    } catch (e) { /* skip a field that won't take the value */ }
  }
  const bytes = await doc.save({ updateFieldAppearances: false });
  return { bytes, filled };
}

// Fill every form in the package. getBlank(code) -> Uint8Array.
export async function fillPackage(data, formCodes, getBlank, fieldIndex) {
  const results = [];
  for (const code of formCodes) {
    if (!PDF_FILES[code]) continue;
    try {
      const blank = await getBlank(code);
      const { bytes, filled } = await fillForm(code, data, blank, fieldIndex);
      results.push({ code, bytes, filled });
    } catch (e) {
      results.push({ code, error: String(e.message || e) });
    }
  }
  return results;
}
