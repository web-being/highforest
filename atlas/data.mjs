// Content of the terpene atlas. One file, so a translation is one file.
// Identity data: PubChem (NIH), fetched 2026-11-10; boiling points and odour notes carry
// the PubChem contributing source in brackets. Scent words and "found in" lists are
// High Forest's own, from the page this atlas replaces. Study summaries cite refs by number.

export const revised = '11 November 2026'

export const blends = {
  sunshine: { name: 'Sunshine', honey: 'summer wildflower honey', url: '/sunshine-tea' },
  berry: { name: 'Soothing Berry', honey: 'wild-blueberry-blossom honey', url: '/soothing-berry-fr' },
  rest: { name: 'Grounding Rest', honey: 'buckwheat honey', url: '/grounding-rest-fr' },
}

export const families = { mono: 'Monoterpene', alcohol: 'Monoterpene alcohol', sesqui: 'Sesquiterpene' }

// evidence ladder, lowest rung first; a compound's `level` is the highest rung reached (1-based).
// `reach` is the rung's name inside a sentence.
export const rungs = [
  { name: 'Cells', reach: 'cells', note: 'Activity seen in cells or isolated tissue. Shows that something can happen, not that it does in a body.' },
  { name: 'Animals', reach: 'animals', note: 'An effect measured in rodents, often at large doses.' },
  { name: 'People, small', reach: 'small studies in people', note: 'Measured in people: how it is absorbed, or a small laboratory study.' },
  { name: 'People, trials', reach: 'randomized trials', note: 'Randomized, placebo-controlled trials of the compound itself as a treatment.' },
]

export const terpenes = [
  {
    id: 'limonene', name: 'Limonene', cid: 440917, form: 'D-limonene, the (R)-(+) form of citrus peel',
    formula: 'C10H16', mw: 136.23, cas: '5989-27-5', fema: '2633', bp: [176, '175–177 °C', 'JECFA'],
    family: 'mono', iupac: '(4R)-1-methyl-4-prop-1-en-2-ylcyclohexene',
    scent: ['bright', 'citrus', 'fresh', 'lightly sweet'], odour: ['citrus odor', 'HSDB'],
    named: 'After the lemon, Citrus limon.',
    shape: 'One six-membered ring with a tail. The molecule exists in two mirror-image forms; citrus peel makes almost only this one.',
    plants: ['lemon, orange, grapefruit and lime peel', 'juniper berries', 'peppermint', 'rosemary', 'fennel', 'dill', 'caraway and celery seed'],
    plate: { species: 'Citrus × limon', common: 'lemon', printed: 'Citrus Limonum Risso', book: 'kohler' },
    blends: ['sunshine', 'berry'], level: 3,
    studied: [
      ['human', 'People absorb it. A 1998 dose-finding study gave patients with advanced cancer 0.5 to 12 g per square metre of body surface a day by mouth and followed it through the blood.', [9]],
      ['human', 'In a 2013 pilot study, women with early-stage breast cancer took 2 g a day for two to six weeks; limonene collected in breast tissue.', [10]],
      ['human', 'In a 2024 laboratory study of 20 adults, vaporized limonene on its own (1 or 5 mg) could not be told from placebo. Inhaled at 15 mg together with 30 mg of THC, it reduced the anxiety THC caused.', [11]],
    ],
    unknown: 'Whether the small amounts used to flavour food do anything beyond flavour. The studies in which people swallowed it used grams.',
  },
  {
    id: 'alpha-pinene', name: 'α-Pinene', plain: 'Alpha-pinene', cid: 6654,
    formula: 'C10H16', mw: 136.23, cas: '80-56-8', fema: '2902', bp: [155, '155–156 °C', 'JECFA, HSDB'],
    family: 'mono', iupac: '2,6,6-trimethylbicyclo[3.1.1]hept-2-ene',
    scent: ['fresh', 'coniferous', 'resinous', 'herbaceous'], odour: ['characteristic odor of pine', 'HSDB'],
    named: 'After the pine, Pinus. It is the main component of turpentine.',
    shape: 'Two fused rings, one of them a strained four-carbon square. The double bond sits inside the ring.',
    plants: ['pine, spruce and fir', 'rosemary', 'juniper', 'sage', 'eucalyptus', 'basil, dill and parsley', 'frankincense'],
    plate: { species: 'Pinus sylvestris', common: 'Scots pine', printed: 'Pinus silvestris L.', book: 'kohler' },
    blends: ['sunshine', 'berry'], level: 2,
    studied: [
      ['animal', 'In a 2017 study, mice given 10 mg per kg did better on learning and memory tests after their memory had been impaired with the drug scopolamine.', [7]],
      ['review', 'A 2019 review summarizes cell and animal work on inflammation, microbes and nerve cells, and notes how few studies there are.', [6]],
    ],
    unknown: 'Any effect on memory or attention in people. No human trial of the isolated compound is cited here.',
  },
  {
    id: 'beta-pinene', name: 'β-Pinene', plain: 'Beta-pinene', cid: 14896,
    formula: 'C10H16', mw: 136.23, cas: '127-91-3', fema: '2903', bp: [165, '163–166 °C', 'JECFA'],
    family: 'mono', iupac: '6,6-dimethyl-2-methylidenebicyclo[3.1.1]heptane',
    scent: ['green', 'woody', 'resinous', 'pine-like'], odour: ['dry, woody or resinous aroma', 'HSDB'],
    named: 'The second pinene, made of the same atoms as α-pinene.',
    shape: 'It has the same two fused rings, with the double bond outside the ring instead of inside it.',
    plants: ['fir, spruce and pine needles', 'rosemary', 'basil', 'dill and parsley', 'nutmeg'],
    plate: { species: 'Abies alba', common: 'silver fir', printed: 'Abies alba Miller', book: 'kohler' },
    blends: ['sunshine', 'berry'], level: 2,
    studied: [
      ['animal', 'A 2007 rodent study of two eucalyptus-oil compounds found pain relief from cineole. β-Pinene worked weakly, in rats only, and reversed morphine’s pain relief about as much as the blocking drug naloxone does.', [8]],
      ['review', 'Reviewed together with α-pinene for antimicrobial and anti-inflammatory activity in cells and animals.', [6]],
    ],
    unknown: 'Any effect in people. This atlas cites one animal study of the compound itself.',
  },
  {
    id: 'myrcene', name: 'Myrcene', plain: 'Beta-myrcene', cid: 31253,
    formula: 'C10H16', mw: 136.23, cas: '123-35-3', fema: '2762', bp: [167, '166–167 °C', 'JECFA'],
    family: 'mono', iupac: '7-methyl-3-methylideneocta-1,6-diene',
    scent: ['earthy', 'herbal', 'balsamic', 'hop-like', 'gently fruity'], odour: ['pleasant; terpene odor', 'HSDB'],
    named: 'After Myrcia, a genus of the myrtle family.',
    shape: 'It has no ring. Its ten carbons form an open, branched chain with three double bonds: two isoprene units joined head to tail.',
    plants: ['hops', 'mango', 'lemongrass', 'thyme', 'bay laurel', 'basil', 'parsley', 'cardamom'],
    plate: { species: 'Humulus lupulus', common: 'hops', printed: 'Humulus Lupulus L.', book: 'kohler' },
    blends: ['berry', 'rest'], level: 2,
    studied: [
      ['animal', 'Its sleepy reputation comes from rodents given large doses. A 2021 review found animal results for pain, inflammation and sedation, and no human studies.', [15]],
      ['safety', 'In a two-year study, male rats given very large amounts by stomach tube developed kidney tumours, and male mice liver tumours (US National Toxicology Program, 2010). The International Agency for Research on Cancer classed myrcene in 2019 as possibly carcinogenic to humans, group 2B.', [20, 25]],
      ['safety', 'In 2018 the US FDA removed synthetic myrcene from its list of flavourings. The law requires this for any additive that causes cancer in animals at any dose; the FDA stated that it poses no risk to public health at the amounts used in food. Myrcene occurs naturally in hops, mango and thyme.', [21]],
    ],
    unknown: 'Whether it sedates people at all. No human trial exists.',
  },
  {
    id: 'phellandrene', name: 'α-Phellandrene', plain: 'Alpha-phellandrene', cid: 7460,
    formula: 'C10H16', mw: 136.23, cas: '99-83-2', fema: '2856', bp: [175, '175 °C', 'JECFA'],
    family: 'mono', iupac: '2-methyl-5-propan-2-ylcyclohexa-1,3-diene',
    scent: ['fresh', 'green', 'citrus-like', 'lightly peppery'],
    shape: 'A six-membered ring carrying two double bonds side by side.',
    plants: ['dill', 'fennel', 'eucalyptus', 'black pepper', 'cinnamon leaf', 'parsley', 'star anise', 'elemi'],
    plate: { species: 'Foeniculum vulgare', common: 'fennel', printed: 'Foeniculum capillaceum Gilib.', book: 'kohler' },
    blends: ['sunshine', 'rest'], level: 2,
    studied: [
      ['review', 'A 2022 systematic review found twelve studies of the pure compound, in cells and animals, on pain, tumour cells and microbes. It points out that toxicology and human data are missing.', [19]],
    ],
    unknown: 'Its toxicology, which the review says is missing, and any effect in people.',
  },
  {
    id: 'terpinolene', name: 'Terpinolene', cid: 11463,
    formula: 'C10H16', mw: 136.23, cas: '586-62-9', fema: '3046', bp: [184, '183–185 °C', 'JECFA'],
    family: 'mono', iupac: '1-methyl-4-propan-2-ylidenecyclohexene',
    scent: ['fresh', 'herbal', 'softly pine-like', 'lightly floral'], odour: ['sweet, pine odor', 'HSDB'],
    shape: 'Limonene’s close relative: the same ring, with the tail’s double bond turned toward it.',
    plants: ['nutmeg', 'tea tree', 'apple', 'cumin', 'lilac', 'sage and rosemary', 'pine and fir', 'marjoram'],
    plate: { species: 'Myristica fragrans', common: 'nutmeg', printed: 'Myristica fragrans Houtt.', book: 'kohler' },
    blends: ['rest'], level: 2,
    studied: [
      ['animal', 'In a 2013 study, mice breathing air that carried terpinolene moved about less, which the authors read as sedation.', [16]],
    ],
    unknown: 'Whether the mouse result means anything for people. There are no human data.',
  },
  {
    id: 'linalool', name: 'Linalool', cid: 6549,
    formula: 'C10H18O', mw: 154.25, cas: '78-70-6', fema: '2635', bp: [198, '198 °C', 'HSDB'],
    family: 'alcohol', iupac: '3,7-dimethylocta-1,6-dien-3-ol',
    scent: ['soft', 'floral', 'lavender-like', 'gently woody'], odour: ['odor similar to that of bergamot oil and French lavender', 'HSDB'],
    named: 'After linaloe, a fragrant Mexican wood.',
    shape: 'An open chain with an –OH group on the third carbon.',
    plants: ['lavender', 'coriander', 'basil', 'thyme', 'bergamot', 'rosewood', 'jasmine', 'neroli', 'mint'],
    plate: { species: 'Lavandula angustifolia', common: 'lavender', printed: 'Lavandula vera D.C.', book: 'kohler' },
    blends: ['rest'], level: 2, related: true,
    studied: [
      ['animal', 'In a 2018 study, mice that smelled linalool behaved less anxiously. Mice that had lost their sense of smell did not respond, so the effect travelled through the nose.', [13]],
      ['related', 'Five randomized trials of Silexan, an 80 mg daily capsule of a standardized lavender oil, found less anxiety than with placebo. Silexan contains linalool and many other compounds; the trials tested the capsule, not linalool.', [14]],
      ['review', 'A 2021 review summarizes cell and animal findings on sedation, pain and inflammation.', [12]],
    ],
    unknown: 'The effect of isolated linalool in people, by mouth or by nose.',
  },
  {
    id: 'geraniol', name: 'Geraniol', cid: 637566,
    formula: 'C10H18O', mw: 154.25, cas: '106-24-1', fema: '2507', bp: [230, '229–230 °C', 'HSDB, HMDB'],
    family: 'alcohol', iupac: '(2E)-3,7-dimethylocta-2,6-dien-1-ol',
    scent: ['floral', 'rose-like', 'softly citrus', 'sweet'], odour: ['sweet rose odor', 'HSDB'],
    named: 'After the geranium.',
    shape: 'An open chain ending in an –OH group. Bees make it too: it is part of the scent they use to mark the hive entrance.',
    plants: ['rose', 'geranium', 'palmarosa', 'lemongrass', 'citronella', 'neroli', 'coriander', 'blueberry'],
    plate: { species: 'Rosa × centifolia', common: 'cabbage rose', printed: 'Rosa centifolia L.', book: 'kohler' },
    blends: ['sunshine', 'berry'], level: 2,
    studied: [
      ['review', 'A 2019 pharmacology review summarizes cell and animal work on inflammation, oxidation and microbes.', [17]],
    ],
    unknown: 'What eating it does. No trial of swallowed geraniol is cited here.',
  },
  {
    id: 'citronellol', name: 'Citronellol', cid: 8842,
    formula: 'C10H20O', mw: 156.26, cas: '106-22-9', fema: '2309', bp: [225, '224–225 °C', 'HSDB, JECFA'],
    family: 'alcohol', iupac: '3,7-dimethyloct-6-en-1-ol',
    scent: ['rosy', 'citrus-like', 'fresh', 'softly green'], odour: ['fresh rosy odor', 'HSDB'],
    named: 'After citronella grass.',
    shape: 'Geraniol with one double bond filled in by two extra hydrogens.',
    plants: ['rose', 'geranium', 'citronella', 'lemongrass', 'lemon balm', 'eucalyptus', 'mint'],
    plate: { species: 'Melissa officinalis', common: 'lemon balm', printed: 'Melissa officinalis L.', book: 'kohler' },
    blends: ['sunshine', 'rest'], level: 2,
    studied: [
      ['animal', 'In a 2010 study, citronellol injected into the veins of rats (1 to 20 mg per kg) lowered blood pressure, and it relaxed isolated artery tissue.', [18]],
    ],
    unknown: 'Whether any of this happens when it is eaten, and at what amount.',
  },
  {
    id: 'caryophyllene', name: 'β-Caryophyllene', plain: 'Beta-caryophyllene', cid: 5281515,
    formula: 'C15H24', mw: 204.35, cas: '87-44-5', fema: '2252', bp: [256, '256 °C', 'JECFA'],
    family: 'sesqui', iupac: '(1R,4E,9S)-4,11,11-trimethyl-8-methylidenebicyclo[7.2.0]undec-4-ene',
    scent: ['peppery', 'woody', 'warm', 'gently spicy'],
    named: 'After the clove tree, once called Caryophyllus aromaticus. The old name is printed on the plate.',
    shape: 'A nine-membered ring fused to a four-membered one, a rare arrangement in nature.',
    plants: ['clove', 'black pepper', 'hops', 'basil', 'oregano', 'rosemary', 'lavender', 'cinnamon leaf', 'copaiba'],
    plate: { species: 'Syzygium aromaticum', common: 'clove', printed: 'Caryophyllus aromaticus L.', book: 'kohler' },
    blends: ['sunshine', 'berry', 'rest'], level: 2,
    studied: [
      ['animal', 'It binds the CB2 receptor, part of the body’s own cannabinoid system, without the intoxicating effects linked to the CB1 receptor. In a 2014 study, mice fed caryophyllene showed less inflammatory and nerve pain, and the effect depended on CB2.', [4]],
      ['review', 'A 2020 review summarizes mostly preclinical work on chronic inflammation.', [3]],
    ],
    unknown: 'Whether this holds in people. The work cited here was done in mice and in cells.',
  },
  {
    id: 'humulene', name: 'Humulene', plain: 'Alpha-humulene', cid: 5281520,
    formula: 'C15H24', mw: 204.35, cas: '6753-98-6', fema: null, bp: [null, '99–100 °C at 3 mm Hg', 'HMDB'],
    family: 'sesqui', iupac: '(1E,4E,8E)-2,6,6,9-tetramethylcycloundeca-1,4,8-triene',
    scent: ['woody', 'dry', 'herbal', 'hop-like'],
    named: 'After the hop plant, Humulus lupulus.',
    shape: 'One large ring of eleven carbons. It has the same formula as caryophyllene; opening caryophyllene’s small ring gives humulene’s outline.',
    plants: ['hops', 'sage', 'ginger', 'cloves', 'basil', 'black pepper'],
    plate: { species: 'Humulus lupulus', common: 'hops', printed: 'Humulus Lupulus L.', book: 'thome' },
    blends: ['sunshine', 'berry', 'rest'], level: 2,
    studied: [
      ['review', 'A 2024 scoping review covered 340 papers. It found consistent anti-inflammatory effects in rodents and effects on tumour cells in dishes, and no clinical study of isolated humulene.', [5]],
    ],
    unknown: 'Everything in people.',
  },
]

export const books = {
  kohler: 'Köhler’s Medizinal-Pflanzen, Gera, 1887',
  thome: 'O. W. Thomé, Flora von Deutschland, Österreich und der Schweiz, Gera, 1885',
}

export const plateSize = {
  'alpha-pinene': [900, 1167], 'beta-pinene': [900, 1167], caryophyllene: [900, 1266], citronellol: [900, 973],
  geraniol: [900, 1233], humulene: [900, 1452], limonene: [900, 1130], linalool: [900, 1297], myrcene: [900, 1013],
  phellandrene: [900, 1122], terpinolene: [900, 978],
}

export const grades = {
  human: 'People', related: 'People, related preparation', animal: 'Animals', cell: 'Cells', review: 'Review', safety: 'Safety',
}

// amounts in milligrams, for the scale figure
export const doses = [
  { mg: 5, label: 'Limonene, inhaled on its own: no different from placebo', ref: 11 },
  { mg: 15, label: 'Limonene, inhaled with 30 mg of THC: less anxiety than THC alone', ref: 11 },
  { mg: 80, label: 'Lavender-oil capsule, swallowed daily, in the anxiety trials', ref: 14 },
  { mg: 2000, label: 'Limonene, swallowed daily, in the 2013 tissue study', ref: 10 },
  { mg: 14000, label: 'Limonene, highest tolerated daily dose swallowed in 1998 (8 g per m², average adult)', ref: 9 },
]
export const spoon = 8.5 // grams of honey in a heaping teaspoon, High Forest product guide
export const strengths = [
  { pct: 0.01, label: '0.01 %' }, { pct: 0.1, label: '0.1 %' }, { pct: 1, label: '1 %' },
]

export const refs = [
  [1, 'Câmara et al.', 'Plant-Derived Terpenoids: A Plethora of Bioactive Compounds with Several Health Functions and Industrial Applications', 'Molecules 29:3861, 2024', 'https://doi.org/10.3390/molecules29163861'],
  [2, 'Gershenzon & Dudareva', 'The Function of Terpene Natural Products in the Natural World', 'Nature Chemical Biology 3:408, 2007', 'https://doi.org/10.1038/nchembio.2007.5'],
  [3, 'Scandiffio et al.', 'Protective Effects of (E)-β-Caryophyllene in Chronic Inflammation', 'Nutrients 12:3273, 2020', 'https://doi.org/10.3390/nu12113273'],
  [4, 'Klauke et al.', 'The Cannabinoid CB2 Receptor-Selective Phytocannabinoid Beta-Caryophyllene Exerts Analgesic Effects in Mouse Models of Inflammatory and Neuropathic Pain', 'European Neuropsychopharmacology 24:608, 2014', 'https://doi.org/10.1016/j.euroneuro.2013.10.008'],
  [5, 'Dalavaye et al.', 'The Clinical Translation of α-Humulene: A Scoping Review', 'Planta Medica 90:664, 2024', 'https://doi.org/10.1055/a-2307-8183'],
  [6, 'Salehi et al.', 'Therapeutic Potential of α- and β-Pinene: A Miracle Gift of Nature', 'Biomolecules 9:738, 2019', 'https://doi.org/10.3390/biom9110738'],
  [7, 'Lee et al.', 'Amelioration of Scopolamine-Induced Learning and Memory Impairment by α-Pinene in C57BL/6 Mice', 'Evidence-Based Complementary and Alternative Medicine, 2017', 'https://doi.org/10.1155/2017/4926815'],
  [8, 'Liapi et al.', 'Antinociceptive Properties of 1,8-Cineole and β-Pinene, from the Essential Oil of Eucalyptus camaldulensis Leaves, in Rodents', 'Planta Medica 73:1247, 2007', 'https://doi.org/10.1055/s-2007-990224'],
  [9, 'Vigushin et al.', 'Phase I and Pharmacokinetic Study of D-Limonene in Patients with Advanced Cancer', 'Cancer Chemotherapy and Pharmacology 42:111, 1998', 'https://doi.org/10.1007/s002800050793'],
  [10, 'Miller et al.', 'Human Breast Tissue Disposition and Bioactivity of Limonene in Women with Early-Stage Breast Cancer', 'Cancer Prevention Research 6:577, 2013', 'https://doi.org/10.1158/1940-6207.CAPR-12-0452'],
  [11, 'Spindle et al.', 'Vaporized D-Limonene Selectively Mitigates the Acute Anxiogenic Effects of Δ9-Tetrahydrocannabinol in Healthy Adults Who Intermittently Use Cannabis', 'Drug and Alcohol Dependence 257:111267, 2024', 'https://doi.org/10.1016/j.drugalcdep.2024.111267'],
  [12, 'An et al.', 'Recent Updates on Bioactive Properties of Linalool', 'Food & Function 12:10370, 2021', 'https://doi.org/10.1039/D1FO02120F'],
  [13, 'Harada et al.', 'Linalool Odor-Induced Anxiolytic Effects in Mice', 'Frontiers in Behavioral Neuroscience 12:241, 2018', 'https://doi.org/10.3389/fnbeh.2018.00241'],
  [14, '', 'Efficacy of Silexan in Patients with Anxiety Disorders: A Meta-Analysis of Randomized, Placebo-Controlled Trials', 'European Archives of Psychiatry and Clinical Neuroscience 273:1615, 2023', 'https://doi.org/10.1007/s00406-022-01547-w'],
  [15, 'Surendran et al.', 'Myrcene: What Are the Potential Health Benefits of This Flavouring and Aroma Agent?', 'Frontiers in Nutrition 8:699666, 2021', 'https://doi.org/10.3389/fnut.2021.699666'],
  [16, 'Ito & Ito', 'The Sedative Effect of Inhaled Terpinolene in Mice and Its Structure–Activity Relationships', 'Journal of Natural Medicines 67:833, 2013', 'https://doi.org/10.1007/s11418-012-0732-1'],
  [17, 'Lei et al.', 'Pharmacological Properties of Geraniol: A Review', 'Planta Medica 85:48, 2019', 'https://doi.org/10.1055/a-0750-6907'],
  [18, 'Bastos et al.', 'Hypotensive and Vasorelaxant Effects of Citronellol, a Monoterpene Alcohol, in Rats', 'Basic & Clinical Pharmacology & Toxicology 106:331, 2010', 'https://doi.org/10.1111/j.1742-7843.2009.00492.x'],
  [19, 'Radice et al.', 'α-Phellandrene and α-Phellandrene-Rich Essential Oils: A Systematic Review of Biological Activities, Pharmaceutical and Food Applications', 'Life 12:1602, 2022', 'https://doi.org/10.3390/life12101602'],
  [20, 'US National Toxicology Program', 'Toxicology and Carcinogenesis Studies of β-Myrcene in F344/N Rats and B6C3F1 Mice (Gavage Studies)', 'Technical Report 557, 2010', 'https://ntp.niehs.nih.gov/go/tr557'],
  [21, 'US Food and Drug Administration', 'FDA Removes 7 Synthetic Flavoring Substances from Food Additives List', '2018', 'https://www.fda.gov/food/hfp-constituent-updates/fda-removes-7-synthetic-flavoring-substances-food-additives-list'],
  [22, 'Kiecolt-Glaser et al.', 'Olfactory Influences on Mood and Autonomic, Endocrine, and Immune Function', 'Psychoneuroendocrinology 33:328, 2008', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2278291/'],
  [23, 'Donelli et al.', 'Effects of Lavender on Anxiety: A Systematic Review and Meta-Analysis', 'Phytomedicine 65:153099, 2019', 'https://pubmed.ncbi.nlm.nih.gov/31655395/'],
  [24, 'Health Canada', 'Infant Botulism', '', 'https://www.canada.ca/en/health-canada/services/food-safety-vulnerable-populations/infant-botulism.html'],
  [25, 'International Agency for Research on Cancer', 'Some Chemicals That Cause Tumours of the Urinary Tract in Rodents', 'IARC Monographs Volume 119, 2019', 'https://publications.iarc.who.int/575'],
]
