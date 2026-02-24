import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// ── Load .env.local manually (no dotenv package needed) ──────────
function loadEnv() {
  try {
    const lines = readFileSync('.env.local', 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      process.env[key] = val
    }
  } catch {
    console.error('❌  Could not read .env.local — make sure you run from project root')
    process.exit(1)
  }
}

loadEnv()

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// ── AI provider registry (order = priority) ───────────────────────
const PROVIDERS = [
  {
    name:     'Groq',
    apiKey:   process.env.GROQ_API_KEY,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model:    'llama-3.1-8b-instant',
  },
  {
    name:     'Gemini',
    apiKey:   process.env.GEMINI_API_KEY,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model:    'gemini-2.0-flash-lite',
  },
  {
    name:     'DeepSeek',
    apiKey:   process.env.DEEPSEEK_API_KEY,
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model:    'deepseek-chat',
  },
]

const configuredProviders = PROVIDERS.filter(p => p.apiKey)
if (configuredProviders.length === 0) {
  console.error('❌  No AI keys found. Need at least one of: GROQ_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY')
  process.exit(1)
}

// ── Supabase client with service role (bypasses RLS) ─────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const TOPICS = [

  // ── ANCIENT CIVILIZATIONS ─────────────────────────────────────
  'Ancient Egypt', 'Ancient Rome', 'Ancient Greece', 'Ancient Mesopotamia',
  'Ancient India', 'Ancient China', 'The Phoenicians', 'The Carthaginians',
  'The Hittites', 'The Assyrian Empire', 'The Babylonian Empire',
  'The Persian Empire', 'The Akkadian Empire', 'The Sumerian Civilization',
  'The Indus Valley Civilization', 'The Maya Civilization', 'The Aztec Empire',
  'The Inca Empire', 'The Olmec Civilization', 'The Zapotec Civilization',
  'Ancient Nubia', 'The Kingdom of Kush', 'Ancient Carthage',
  'The Minoan Civilization', 'The Mycenaean Civilization',
  'The Etruscan Civilization', 'Ancient Persia', 'The Achaemenid Empire',
  'The Sassanid Empire', 'The Parthian Empire', 'Ancient Korea',
  'Ancient Japan', 'Ancient Vietnam', 'Ancient Cambodia', 'Ancient Thailand',
  'The Khmer Empire', 'The Maurya Empire', 'The Gupta Empire',
  'The Chola Dynasty', 'The Mughal Empire', 'The Vijayanagara Empire',
  'Ancient Sri Lanka', 'The Anatolian Civilizations', 'Troy and the Trojan War',
  'Ancient Carthage', 'The Berber Kingdoms', 'Ancient Ethiopia',
  'The Aksumite Empire', 'The Kingdom of Mali', 'The Songhai Empire',
  'Great Zimbabwe', 'The Swahili Coast Civilization',

  // ── MEDIEVAL HISTORY ──────────────────────────────────────────
  'Medieval Europe', 'The Byzantine Empire', 'The Holy Roman Empire',
  'The Carolingian Empire', 'The Frankish Kingdom', 'The Viking Age',
  'The Norman Conquest', 'The Crusades', 'The First Crusade',
  'The Second Crusade', 'The Third Crusade', 'The Fourth Crusade',
  'The Black Death', 'The Hundred Years War', 'The Wars of the Roses',
  'The Reconquista', 'Medieval Feudalism', 'Medieval Knights and Chivalry',
  'The Magna Carta', 'The Papal States', 'The Inquisition',
  'The Ottoman Empire', 'The Mongol Empire', 'Genghis Khan',
  'Kublai Khan', 'The Silk Road', 'The Hanseatic League',
  'The Italian City States', 'The Republic of Venice',
  'The Republic of Florence', 'The Medici Family', 'Medieval Islam',
  'The Abbasid Caliphate', 'The Umayyad Caliphate', 'The Fatimid Caliphate',
  'Saladin and the Ayyubid Dynasty', 'The Mamluk Sultanate',
  'The Delhi Sultanate', 'Medieval Japan', 'The Samurai',
  'The Shogunate System', 'Medieval China', 'The Tang Dynasty',
  'The Song Dynasty', 'The Ming Dynasty', 'The Yuan Dynasty',
  'Medieval Africa', 'The Ghana Empire', 'The Mali Empire',
  'Mansa Musa', 'Timbuktu as a Center of Learning',

  // ── EARLY MODERN HISTORY ──────────────────────────────────────
  'The Renaissance', 'The Italian Renaissance', 'The Northern Renaissance',
  'Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Donatello',
  'The Reformation', 'Martin Luther', 'John Calvin', 'The Counter Reformation',
  'The Council of Trent', 'The Age of Exploration', 'Christopher Columbus',
  'Vasco da Gama', 'Ferdinand Magellan', 'Hernán Cortés',
  'Francisco Pizarro', 'The Columbian Exchange', 'The Transatlantic Slave Trade',
  'The Spanish Empire', 'The Portuguese Empire', 'The Dutch Golden Age',
  'The British Empire', 'The French Empire', 'The Thirty Years War',
  'The English Civil War', 'The Glorious Revolution', 'The Scientific Revolution',
  'Galileo Galilei', 'Isaac Newton', 'Johannes Kepler', 'Nicolaus Copernicus',
  'Francis Bacon', 'René Descartes', 'The Enlightenment',
  'John Locke', 'Voltaire', 'Jean-Jacques Rousseau', 'Montesquieu',
  'The American Revolution', 'The Declaration of Independence',
  'The United States Constitution', 'The French Revolution',
  'The Reign of Terror', 'Napoleon Bonaparte', 'The Napoleonic Wars',
  'The Battle of Waterloo', 'The Congress of Vienna',
  'The Industrial Revolution', 'The Steam Engine', 'The Railway Age',
  'The Factory System', 'Child Labor in the Industrial Revolution',
  'The Luddites', 'Urbanization in the 19th Century',

  // ── MODERN HISTORY ────────────────────────────────────────────
  'The Abolition of Slavery', 'The American Civil War', 'Abraham Lincoln',
  'The Reconstruction Era', 'The Gilded Age', 'The Progressive Era',
  'The First World War', 'The Assassination of Franz Ferdinand',
  'Trench Warfare', 'The Battle of the Somme', 'The Battle of Verdun',
  'The Treaty of Versailles', 'The Russian Revolution',
  'Vladimir Lenin', 'Leon Trotsky', 'Joseph Stalin',
  'The Weimar Republic', 'The Rise of Fascism', 'Benito Mussolini',
  'Adolf Hitler', 'The Nazi Party', 'The Great Depression',
  'The New Deal', 'Franklin D Roosevelt', 'The Second World War',
  'The Holocaust', 'The Battle of Britain', 'Operation Barbarossa',
  'The Pacific War', 'The Manhattan Project', 'The Atomic Bombings of Hiroshima and Nagasaki',
  'The Nuremberg Trials', 'The Cold War', 'The Marshall Plan',
  'The Berlin Blockade', 'The Korean War', 'The Cuban Missile Crisis',
  'The Vietnam War', 'The Space Race', 'The Moon Landing',
  'The Civil Rights Movement', 'Martin Luther King Jr',
  'Rosa Parks', 'Malcolm X', 'Nelson Mandela', 'Apartheid',
  'The Iranian Revolution', 'The Soviet Afghan War',
  'The Fall of the Berlin Wall', 'The Collapse of the Soviet Union',
  'The Gulf War', 'The Rwandan Genocide', 'The Bosnian War',
  'September 11 Attacks', 'The War in Afghanistan', 'The Iraq War',
  'The Arab Spring', 'The Syrian Civil War', 'The Rise of ISIS',
  'The Global Financial Crisis 2008', 'Brexit', 'The COVID-19 Pandemic',
  'The Russia Ukraine War',

  // ── WORLD WARS IN DEPTH ───────────────────────────────────────
  'World War I Causes', 'World War I Western Front', 'World War I Eastern Front',
  'World War I Naval Warfare', 'World War I Air Warfare', 'World War I Technology',
  'World War I Medicine', 'World War I Propaganda', 'World War I Home Front',
  'World War II Causes', 'World War II European Theater',
  'World War II Pacific Theater', 'World War II North African Campaign',
  'World War II Italian Campaign', 'World War II D-Day Normandy',
  'World War II Stalingrad', 'World War II Intelligence and Codebreaking',
  'World War II Women in the War', 'World War II Holocaust',
  'World War II Resistance Movements', 'World War II War Crimes',
  'World War II Aftermath', 'World War II Technology and Weapons',

  // ── WARS AND CONFLICTS ────────────────────────────────────────
  'The Peloponnesian War', 'The Punic Wars', 'The Roman Civil Wars',
  'The Byzantine Arab Wars', 'The Mongol Invasions', 'The Hundred Years War',
  'The Ottoman Wars in Europe', 'The Nine Years War', 'The War of Spanish Succession',
  'The Seven Years War', 'The American Revolutionary War',
  'The Napoleonic Wars', 'The Crimean War', 'The Boer War',
  'The Russo Japanese War', 'The Balkan Wars', 'The Spanish Civil War',
  'The Chinese Civil War', 'The Arab Israeli Conflict',
  'The Six Day War', 'The Yom Kippur War', 'The Falklands War',
  'The Iran Iraq War', 'The Gulf War', 'The Kosovo War',
  'The Chechen Wars', 'The Congo Wars', 'The Darfur Conflict',
  'The Libyan Civil War', 'The Yemeni Civil War',

  // ── GEOGRAPHY ─────────────────────────────────────────────────
  'The Amazon Rainforest', 'The Sahara Desert', 'The Himalayas',
  'The Alps', 'The Andes', 'The Rocky Mountains', 'The Appalachian Mountains',
  'The Great Barrier Reef', 'The Arctic Ocean', 'The Antarctic',
  'The Pacific Ocean', 'The Atlantic Ocean', 'The Indian Ocean',
  'The Mediterranean Sea', 'The Red Sea', 'The Black Sea',
  'The Caspian Sea', 'The Great Lakes', 'The Nile River',
  'The Amazon River', 'The Congo River', 'The Yangtze River',
  'The Ganges River', 'The Mississippi River', 'The Rhine River',
  'The Danube River', 'The Tigris and Euphrates Rivers',
  'The Gobi Desert', 'The Patagonia', 'The Serengeti',
  'The Great Rift Valley', 'The Mariana Trench', 'Mount Everest',
  'K2', 'Kilimanjaro', 'The Grand Canyon', 'Yellowstone',
  'The Galapagos Islands', 'Iceland Geology', 'New Zealand Geography',
  'The Great Plains', 'The Siberian Tundra', 'The Congo Basin',
  'The Mekong River', 'The Volga River', 'The Niger River',
  'The Zambezi River', 'Victoria Falls', 'Niagara Falls',
  'The Dead Sea', 'The Aral Sea Crisis', 'The Great Artesian Basin',

  // ── COUNTRIES OF THE WORLD ────────────────────────────────────
  'History of the United States', 'History of the United Kingdom',
  'History of France', 'History of Germany', 'History of Russia',
  'History of China', 'History of Japan', 'History of India',
  'History of Brazil', 'History of Australia', 'History of Canada',
  'History of Mexico', 'History of Argentina', 'History of South Africa',
  'History of Nigeria', 'History of Egypt', 'History of Turkey',
  'History of Iran', 'History of Saudi Arabia', 'History of Israel',
  'History of Pakistan', 'History of Bangladesh', 'History of Indonesia',
  'History of South Korea', 'History of North Korea', 'History of Vietnam',
  'History of Thailand', 'History of the Philippines', 'History of Malaysia',
  'History of Spain', 'History of Italy', 'History of Poland',
  'History of Ukraine', 'History of Sweden', 'History of Norway',
  'History of Denmark', 'History of Finland', 'History of Greece',
  'History of Portugal', 'History of the Netherlands', 'History of Belgium',
  'History of Switzerland', 'History of Austria', 'History of Hungary',
  'History of Czech Republic', 'History of Romania', 'History of Bulgaria',
  'History of Serbia', 'History of Croatia', 'History of Colombia',
  'History of Venezuela', 'History of Peru', 'History of Chile',
  'History of Cuba', 'History of Kenya', 'History of Ethiopia',
  'History of Ghana', 'History of Morocco', 'History of Algeria',
  'History of Congo', 'History of Tanzania', 'History of Uganda',
  'History of Zimbabwe', 'History of Mozambique', 'History of Angola',

  // ── SCIENCE — PHYSICS ─────────────────────────────────────────
  'Quantum Mechanics', 'Quantum Computing', 'Quantum Entanglement',
  'Quantum Field Theory', 'Quantum Cryptography', 'The Standard Model',
  'Particle Physics', 'The Higgs Boson', 'String Theory',
  'Supersymmetry', 'Loop Quantum Gravity', 'General Relativity',
  'Special Relativity', 'The Theory of Everything', 'Dark Matter',
  'Dark Energy', 'Black Holes', 'Neutron Stars', 'White Dwarfs',
  'Pulsars', 'Quasars', 'Gravitational Waves', 'The Big Bang Theory',
  'Cosmic Inflation', 'The Multiverse', 'Thermodynamics',
  'Classical Mechanics', 'Electromagnetism', 'Nuclear Physics',
  'Plasma Physics', 'Condensed Matter Physics', 'Optics',
  'Acoustics', 'Fluid Dynamics', 'Chaos Theory', 'Superconductivity',
  'Semiconductor Physics', 'Photonics', 'Atomic Physics',
  'Molecular Physics', 'Nuclear Fusion', 'Nuclear Fission',
  'Radioactivity', 'The Large Hadron Collider',

  // ── SCIENCE — CHEMISTRY ───────────────────────────────────────
  'Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry',
  'Biochemistry', 'Analytical Chemistry', 'Polymer Chemistry',
  'Medicinal Chemistry', 'Environmental Chemistry', 'Nuclear Chemistry',
  'The Periodic Table', 'Chemical Bonding', 'Acid Base Chemistry',
  'Oxidation and Reduction', 'Electrochemistry', 'Thermochemistry',
  'Chemical Kinetics', 'Catalysis', 'Green Chemistry',
  'Nanotechnology', 'Materials Science', 'Crystallography',
  'Spectroscopy', 'Chromatography', 'The Discovery of Elements',

  // ── SCIENCE — BIOLOGY ─────────────────────────────────────────
  'Evolutionary Biology', 'Charles Darwin', 'Natural Selection',
  'Genetics', 'DNA and RNA', 'The Human Genome', 'Epigenetics',
  'CRISPR Gene Editing', 'Stem Cell Research', 'Cell Biology',
  'Molecular Biology', 'Microbiology', 'Virology', 'Immunology',
  'Neuroscience', 'The Human Brain', 'Ecology', 'Marine Biology',
  'Botany', 'Zoology', 'Mycology', 'Bacteriology',
  'Parasitology', 'Entomology', 'Ornithology', 'Primatology',
  'Developmental Biology', 'Systems Biology', 'Synthetic Biology',
  'Bioinformatics', 'Proteomics', 'Genomics', 'Metabolomics',
  'Antibiotic Resistance', 'Vaccine Development', 'Cancer Biology',
  'Aging and Longevity Research', 'The Microbiome', 'Ocean Ecosystems',
  'Rainforest Ecosystems', 'Coral Reef Ecosystems', 'Biodiversity',
  'Extinction Events', 'The Cambrian Explosion', 'Paleontology',
  'Dinosaurs', 'Human Evolution', 'Homo Sapiens Origins',
  'The Neanderthals', 'Denisovans',

  // ── SCIENCE — EARTH SCIENCES ──────────────────────────────────
  'Climate Science', 'Global Warming', 'Climate Change',
  'The Carbon Cycle', 'Ocean Acidification', 'Sea Level Rise',
  'Glaciology', 'Meteorology', 'Atmospheric Science',
  'Geology', 'Plate Tectonics', 'Volcanology', 'Seismology',
  'Oceanography', 'Hydrology', 'Soil Science', 'Geomorphology',
  'Mineralogy', 'Geochemistry', 'Paleoclimatology',
  'The Ozone Layer', 'El Nino and La Nina', 'Hurricanes and Typhoons',
  'Earthquakes', 'Tsunamis', 'Volcanic Eruptions',
  'The Water Cycle', 'Groundwater Systems', 'Permafrost',
  'The Arctic Ice Cap', 'Antarctic Ice Sheet',

  // ── ASTRONOMY AND SPACE ───────────────────────────────────────
  'The Solar System', 'The Sun', 'Mercury', 'Venus', 'Earth',
  'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  'Asteroids', 'Comets', 'Meteors and Meteorites', 'The Asteroid Belt',
  'The Kuiper Belt', 'The Oort Cloud', 'Exoplanets',
  'Habitable Zone Planets', 'The Search for Extraterrestrial Life',
  'The Milky Way Galaxy', 'Andromeda Galaxy', 'Galaxy Formation',
  'Galaxy Clusters', 'Supernovae', 'The James Webb Space Telescope',
  'The Hubble Space Telescope', 'Space Exploration History',
  'The Apollo Program', 'The Moon Landing', 'Mars Exploration',
  'Mars Colonization', 'SpaceX', 'NASA History', 'The ISS',
  'Satellite Technology', 'The Voyager Missions', 'The New Horizons Mission',
  'The Cassini Mission', 'The Kepler Mission', 'Space Telescopes',
  'Radio Astronomy', 'Gravitational Wave Detection', 'SETI',
  'Astrobiology', 'Terraforming', 'Space Tourism',
  'Rocket Science', 'Orbital Mechanics', 'The Drake Equation',
  'Fermi Paradox', 'Cosmic Microwave Background', 'Dark Matter Detection',

  // ── MATHEMATICS ───────────────────────────────────────────────
  'Number Theory', 'Algebra', 'Calculus', 'Linear Algebra',
  'Differential Equations', 'Topology', 'Geometry', 'Trigonometry',
  'Statistics', 'Probability Theory', 'Combinatorics', 'Graph Theory',
  'Set Theory', 'Logic and Mathematical Proof', 'Category Theory',
  'Abstract Algebra', 'Real Analysis', 'Complex Analysis',
  'Numerical Analysis', 'Optimization Theory', 'Game Theory',
  'Information Theory', 'Cryptography Mathematics', 'Fractal Geometry',
  'Chaos Theory Mathematics', 'The Riemann Hypothesis',
  'Fermat Last Theorem', 'The Pythagorean Theorem',
  'Euclid and Euclidean Geometry', 'Non Euclidean Geometry',
  'The History of Mathematics', 'Famous Mathematicians',
  'Mathematical Constants', 'Prime Numbers', 'The Fibonacci Sequence',
  'The Golden Ratio', 'Infinity in Mathematics', 'Mathematical Paradoxes',

  // ── TECHNOLOGY ────────────────────────────────────────────────
  'Artificial Intelligence', 'Machine Learning', 'Deep Learning',
  'Neural Networks', 'Natural Language Processing', 'Computer Vision',
  'Reinforcement Learning', 'Generative AI', 'Large Language Models',
  'ChatGPT and AI Assistants', 'AI Ethics', 'AI Safety',
  'The History of Computing', 'Alan Turing', 'The Turing Test',
  'Von Neumann Architecture', 'Transistors', 'Integrated Circuits',
  'Moores Law', 'Microprocessors', 'Semiconductor Manufacturing',
  'The History of the Internet', 'The World Wide Web',
  'Tim Berners Lee', 'Web Development', 'Cloud Computing',
  'Cybersecurity', 'Hacking and Ethical Hacking', 'Encryption',
  'Blockchain Technology', 'Bitcoin', 'Ethereum', 'Cryptocurrency',
  'Decentralized Finance', 'NFTs', 'Web3', 'The Metaverse',
  'Virtual Reality', 'Augmented Reality', 'Mixed Reality',
  '5G Networks', '6G Networks', 'The Internet of Things',
  'Smart Cities', 'Autonomous Vehicles', 'Electric Vehicles',
  'Robotics', 'Industrial Automation', 'Drones',
  'Quantum Computing', 'Quantum Internet', 'Edge Computing',
  'Supercomputers', 'Operating Systems', 'Linux History',
  'Open Source Software', 'Software Engineering', 'Agile Development',
  'DevOps', 'Databases', 'Big Data', 'Data Science',
  'Computer Graphics', 'Video Game Technology', 'Social Media Technology',
  'Search Engine Technology', 'Recommendation Algorithms',
  'Facial Recognition', 'Biometric Technology', 'GPS Technology',
  'Satellite Communications', '3D Printing', 'Nanotechnology',
  'CRISPR Technology', 'Biotechnology', 'Medical Technology',
  'Nuclear Technology', 'Renewable Energy Technology',
  'Solar Panel Technology', 'Wind Turbine Technology',
  'Battery Technology', 'Hydrogen Energy', 'Smart Grid Technology',

  // ── ECONOMICS AND FINANCE ─────────────────────────────────────
  'Macroeconomics', 'Microeconomics', 'Behavioral Economics',
  'Development Economics', 'International Economics', 'Labor Economics',
  'Environmental Economics', 'Health Economics', 'Public Economics',
  'Monetary Economics', 'Financial Economics', 'Economic History',
  'Capitalism', 'Socialism', 'Communism', 'Mixed Economy',
  'Free Market Economics', 'Keynesian Economics', 'Austrian Economics',
  'Monetarism', 'Supply Side Economics', 'Modern Monetary Theory',
  'Inflation', 'Deflation', 'Stagflation', 'Hyperinflation',
  'Interest Rates', 'Central Banking', 'The Federal Reserve',
  'The European Central Bank', 'The World Bank', 'The IMF',
  'The WTO', 'OPEC', 'The G20', 'The G7',
  'GDP and Economic Growth', 'Unemployment', 'Poverty',
  'Income Inequality', 'The Gini Coefficient', 'Globalization',
  'Free Trade', 'Protectionism', 'Tariffs and Trade Wars',
  'The Gold Standard', 'Bretton Woods System', 'Fiat Currency',
  'Foreign Exchange Markets', 'Stock Markets', 'Bond Markets',
  'Commodity Markets', 'Derivatives', 'Hedge Funds',
  'Private Equity', 'Venture Capital', 'Investment Banking',
  'Retail Banking', 'Insurance Industry', 'Real Estate Economics',
  'The Housing Market', 'Financial Bubbles', 'The Tulip Mania',
  'The South Sea Bubble', 'The Great Depression Economics',
  'The 2008 Financial Crisis', 'Too Big to Fail',
  'Quantitative Easing', 'Austerity Economics', 'Fiscal Policy',
  'Tax Policy', 'Government Debt', 'National Debt',
  'Supply Chain Economics', 'Game Theory in Economics',
  'Auction Theory', 'Mechanism Design', 'Nobel Prize in Economics',

  // ── CRYPTOCURRENCY IN DEPTH ───────────────────────────────────
  'Bitcoin History', 'Satoshi Nakamoto', 'Bitcoin Mining',
  'Bitcoin Halving', 'Ethereum History', 'Smart Contracts',
  'Decentralized Applications', 'DeFi Protocols', 'Yield Farming',
  'Liquidity Pools', 'Stablecoins', 'USDT Tether', 'USDC',
  'Crypto Exchanges', 'Crypto Wallets', 'Private Keys and Seed Phrases',
  'Crypto Regulation', 'Crypto Taxation', 'NFT History',
  'The NFT Boom and Bust', 'Play to Earn Gaming', 'DAOs',
  'Layer 2 Solutions', 'Polygon Network', 'Solana',
  'Cardano', 'Polkadot', 'Avalanche', 'Chainlink',
  'Ripple XRP', 'Litecoin', 'Dogecoin', 'Shiba Inu',
  'Crypto Market Cycles', 'Bull and Bear Markets in Crypto',
  'The FTX Collapse', 'Mt Gox Hack', 'Crypto Security',
  'Zero Knowledge Proofs', 'Merkle Trees', 'Consensus Mechanisms',
  'Proof of Work', 'Proof of Stake', 'Delegated Proof of Stake',

  // ── POLITICS AND GOVERNMENT ───────────────────────────────────
  'Democracy', 'Authoritarianism', 'Totalitarianism', 'Fascism',
  'Communism', 'Socialism', 'Liberalism', 'Conservatism',
  'Libertarianism', 'Nationalism', 'Populism', 'Anarchism',
  'The United Nations', 'NATO', 'The European Union',
  'The African Union', 'ASEAN', 'BRICS', 'The Shanghai Cooperation Organisation',
  'US Politics', 'UK Politics', 'French Politics', 'German Politics',
  'Russian Politics', 'Chinese Politics', 'Indian Politics',
  'Electoral Systems', 'Voting Rights', 'Gerrymandering',
  'Campaign Finance', 'Lobbying', 'Political Parties',
  'The US Constitution', 'Separation of Powers', 'Federalism',
  'Human Rights', 'International Law', 'War Crimes',
  'Genocide', 'The Geneva Conventions', 'The ICC',
  'Diplomacy', 'Sanctions', 'Foreign Policy',
  'Intelligence Agencies', 'The CIA', 'The KGB and FSB',
  'MI6', 'Mossad', 'Espionage', 'Propaganda',
  'Fake News and Misinformation', 'Censorship', 'Press Freedom',
  'Civil Liberties', 'Privacy Rights', 'Surveillance',

  // ── PHILOSOPHY ────────────────────────────────────────────────
  'History of Philosophy', 'Ancient Greek Philosophy', 'Socrates',
  'Plato', 'Aristotle', 'Epicurus', 'Stoicism', 'Cynicism',
  'Skepticism', 'Neoplatonism', 'Medieval Philosophy',
  'Thomas Aquinas', 'Islamic Philosophy', 'René Descartes',
  'Baruch Spinoza', 'Gottfried Wilhelm Leibniz', 'John Locke',
  'George Berkeley', 'David Hume', 'Immanuel Kant',
  'Georg Wilhelm Friedrich Hegel', 'Arthur Schopenhauer',
  'Søren Kierkegaard', 'Friedrich Nietzsche', 'Karl Marx',
  'Existentialism', 'Jean Paul Sartre', 'Simone de Beauvoir',
  'Albert Camus', 'Martin Heidegger', 'Edmund Husserl',
  'Phenomenology', 'Analytic Philosophy', 'Bertrand Russell',
  'Ludwig Wittgenstein', 'Logical Positivism', 'Philosophy of Language',
  'Philosophy of Mind', 'Consciousness', 'The Hard Problem of Consciousness',
  'Free Will', 'Determinism', 'Ethics', 'Moral Philosophy',
  'Utilitarianism', 'Deontological Ethics', 'Virtue Ethics',
  'Applied Ethics', 'Bioethics', 'Environmental Ethics',
  'Political Philosophy', 'Social Contract Theory', 'Justice',
  'Epistemology', 'Metaphysics', 'Ontology', 'Logic',
  'Philosophy of Science', 'Philosophy of Religion',
  'Eastern Philosophy', 'Confucianism', 'Taoism', 'Buddhism',
  'Hinduism Philosophy', 'Zen Buddhism', 'Philosophy of Art',
  'Aesthetics', 'Philosophy of Mathematics',

  // ── RELIGION ──────────────────────────────────────────────────
  'History of Christianity', 'The Bible', 'Jesus Christ',
  'The Apostles', 'Early Christianity', 'The Catholic Church',
  'The Protestant Reformation', 'Eastern Orthodox Christianity',
  'History of Islam', 'The Quran', 'Prophet Muhammad',
  'Sunni Islam', 'Shia Islam', 'Sufism', 'Islamic Golden Age',
  'History of Judaism', 'The Torah', 'The Talmud', 'Zionism',
  'History of Hinduism', 'The Vedas', 'The Upanishads',
  'The Bhagavad Gita', 'Hindu Gods and Goddesses',
  'History of Buddhism', 'Siddhartha Gautama', 'Buddhist Scriptures',
  'Theravada Buddhism', 'Mahayana Buddhism', 'Tibetan Buddhism',
  'History of Sikhism', 'Guru Nanak', 'The Guru Granth Sahib',
  'Jainism', 'Zoroastrianism', 'Shintoism', 'Taoism',
  'Confucianism', 'Ancient Egyptian Religion', 'Greek Mythology',
  'Roman Mythology', 'Norse Mythology', 'Celtic Mythology',
  'Aztec Religion', 'Maya Religion', 'Inca Religion',
  'Indigenous Religions', 'Animism', 'Shamanism',
  'New Age Movements', 'Atheism', 'Agnosticism', 'Secularism',
  'Religious Fundamentalism', 'Interfaith Dialogue',

  // ── PSYCHOLOGY ────────────────────────────────────────────────
  'History of Psychology', 'Sigmund Freud', 'Psychoanalysis',
  'Carl Jung', 'Alfred Adler', 'Behavioral Psychology',
  'B F Skinner', 'Ivan Pavlov', 'Classical Conditioning',
  'Operant Conditioning', 'Cognitive Psychology', 'Jean Piaget',
  'Developmental Psychology', 'Social Psychology', 'Humanistic Psychology',
  'Abraham Maslow', 'Positive Psychology', 'Neuropsychology',
  'Clinical Psychology', 'Abnormal Psychology', 'Personality Psychology',
  'The Big Five Personality Traits', 'Myers Briggs Personality Types',
  'Cognitive Behavioral Therapy', 'Psychotherapy', 'Mindfulness',
  'Meditation and the Brain', 'Depression', 'Anxiety Disorders',
  'Schizophrenia', 'Bipolar Disorder', 'PTSD',
  'ADHD', 'Autism Spectrum Disorder', 'OCD',
  'Eating Disorders', 'Addiction Psychology', 'Sleep Psychology',
  'Memory and Forgetting', 'Learning and Cognition', 'Intelligence',
  'IQ Testing', 'Emotional Intelligence', 'Motivation',
  'Stress and Coping', 'Trauma', 'Resilience',
  'Group Dynamics', 'Conformity and Obedience', 'The Milgram Experiment',
  'The Stanford Prison Experiment', 'Cognitive Biases',
  'Heuristics in Decision Making', 'Prospect Theory',

  // ── SOCIOLOGY ─────────────────────────────────────────────────
  'Sociology Foundations', 'Émile Durkheim', 'Max Weber', 'Karl Marx',
  'Social Class', 'Social Mobility', 'Stratification',
  'Race and Ethnicity', 'Gender and Society', 'Feminism',
  'Intersectionality', 'LGBTQ Rights History', 'Immigration',
  'Urbanization', 'Suburban Sprawl', 'Rural Sociology',
  'The Family as a Social Institution', 'Marriage and Divorce',
  'Education Systems', 'Religion in Society', 'Crime and Deviance',
  'Mass Media and Society', 'Social Movements', 'Globalization',
  'Consumer Culture', 'Cultural Capital', 'Social Capital',
  'Network Theory', 'Collective Behavior', 'Social Change',

  // ── MEDICINE AND HEALTH ───────────────────────────────────────
  'History of Medicine', 'Hippocrates', 'Galen', 'Ibn Sina',
  'The Germ Theory of Disease', 'Louis Pasteur', 'Robert Koch',
  'The Discovery of Penicillin', 'Alexander Fleming',
  'Vaccines and Vaccination', 'The Smallpox Eradication',
  'The Polio Vaccine', 'HIV AIDS History', 'Cancer Treatment',
  'Chemotherapy', 'Radiation Therapy', 'Immunotherapy',
  'Organ Transplantation', 'Heart Surgery', 'Neurosurgery',
  'Anesthesia History', 'Antibiotics', 'Antivirals',
  'Mental Health Treatment History', 'Psychiatry',
  'Public Health', 'Epidemiology', 'Pandemics in History',
  'The Black Death', 'The Spanish Flu', 'The COVID-19 Pandemic',
  'The Ebola Virus', 'Malaria', 'Tuberculosis',
  'Diabetes', 'Heart Disease', 'Stroke',
  'Alzheimers Disease', 'Parkinsons Disease',
  'Genetic Diseases', 'Rare Diseases', 'Autoimmune Diseases',
  'Nutrition Science', 'The Gut Microbiome',
  'Exercise Science', 'Sports Medicine', 'Telemedicine',
  'Medical Imaging', 'MRI Technology', 'AI in Medicine',
  'Precision Medicine', 'Gene Therapy', 'Stem Cell Therapy',

  // ── ARTS AND CULTURE ──────────────────────────────────────────
  'History of Art', 'Prehistoric Art', 'Egyptian Art',
  'Greek Art', 'Roman Art', 'Byzantine Art', 'Medieval Art',
  'Renaissance Art', 'Baroque Art', 'Rococo Art',
  'Neoclassicism', 'Romanticism', 'Realism in Art',
  'Impressionism', 'Post Impressionism', 'Expressionism',
  'Cubism', 'Surrealism', 'Abstract Expressionism',
  'Pop Art', 'Minimalism', 'Contemporary Art',
  'Street Art', 'Digital Art', 'Photography History',
  'History of Music', 'Classical Music', 'The Symphony',
  'Opera', 'Jazz History', 'The Blues', 'Rock and Roll History',
  'The Beatles', 'Hip Hop History', 'Electronic Music',
  'World Music', 'Folk Music', 'Country Music',
  'Music Theory', 'Musical Instruments', 'The Piano',
  'The Guitar', 'The Violin', 'The Orchestra',
  'History of Literature', 'Ancient Literature', 'Greek Tragedy',
  'Shakespeare', 'The Novel', 'Romanticism in Literature',
  'Realism in Literature', 'Modernism in Literature',
  'Postmodernism in Literature', 'Science Fiction Literature',
  'Poetry History', 'Homer', 'Dante', 'Chaucer',
  'History of Cinema', 'Silent Film Era', 'Hollywood Golden Age',
  'World Cinema', 'Documentary Film', 'Animation History',
  'History of Theater', 'Greek Theater', 'Elizabethan Theater',
  'Modern Theater', 'Musical Theater', 'Architecture History',
  'Ancient Architecture', 'Gothic Architecture', 'Renaissance Architecture',
  'Baroque Architecture', 'Modernist Architecture', 'Contemporary Architecture',
  'Fashion History', 'Design History', 'Industrial Design',
  'Graphic Design History', 'Typography',

  // ── SPORTS ────────────────────────────────────────────────────
  'History of the Olympics', 'Ancient Olympic Games', 'Modern Olympic Games',
  'History of Football Soccer', 'FIFA World Cup History',
  'History of Cricket', 'The Ashes', 'History of Tennis',
  'Wimbledon History', 'History of Basketball', 'NBA History',
  'History of Baseball', 'MLB History', 'History of American Football',
  'NFL History', 'History of Rugby', 'History of Golf',
  'History of Swimming', 'History of Athletics', 'History of Boxing',
  'History of Chess', 'History of Formula 1', 'History of Cycling',
  'Tour de France History', 'History of Martial Arts',
  'History of the Commonwealth Games',

  // ── ENVIRONMENT ───────────────────────────────────────────────
  'Climate Change Science', 'The Paris Agreement', 'The Kyoto Protocol',
  'Renewable Energy', 'Solar Energy', 'Wind Energy',
  'Hydroelectric Power', 'Geothermal Energy', 'Tidal Energy',
  'Nuclear Energy', 'Fossil Fuels', 'Oil Industry History',
  'Natural Gas', 'Coal Industry History', 'Deforestation',
  'Reforestation', 'Biodiversity Loss', 'Species Extinction',
  'Conservation Biology', 'Wildlife Conservation', 'Marine Conservation',
  'Plastic Pollution', 'Ocean Plastic', 'Air Pollution',
  'Water Pollution', 'Soil Degradation', 'Desertification',
  'Food Security', 'Water Security', 'Sustainable Agriculture',
  'Organic Farming', 'GMO Crops', 'Vertical Farming',
  'Circular Economy', 'Carbon Capture', 'Carbon Credits',
  'Environmental Law', 'Environmental Activism', 'Greenpeace',
  'WWF History', 'The UN Environment Programme',

  // ── FOOD AND CUISINE ──────────────────────────────────────────
  'History of Food', 'The Agricultural Revolution', 'Spice Trade History',
  'Italian Cuisine History', 'French Cuisine History', 'Chinese Cuisine History',
  'Indian Cuisine History', 'Japanese Cuisine History', 'Mexican Cuisine History',
  'Middle Eastern Cuisine', 'Mediterranean Diet', 'Street Food Culture',
  'The History of Wine', 'Beer Brewing History', 'Coffee History',
  'Tea History', 'The History of Sugar', 'The History of Salt',
  'Fast Food Industry', 'The Slow Food Movement', 'Veganism',
  'Vegetarianism', 'Food Science', 'Fermentation',
  'Molecular Gastronomy', 'Food Safety', 'Food Preservation History',

  // ── LANGUAGE AND LINGUISTICS ──────────────────────────────────
  'History of Language', 'How Language Evolved', 'Proto Indo European',
  'The Romance Languages', 'The Germanic Languages', 'The Slavic Languages',
  'The Semitic Languages', 'The Sino Tibetan Languages',
  'The Dravidian Languages', 'Endangered Languages',
  'Sign Language', 'Braille', 'Writing Systems History',
  'The Alphabet History', 'Cuneiform', 'Hieroglyphics',
  'Chinese Writing System', 'Arabic Script', 'Linguistics',
  'Phonetics', 'Grammar', 'Semantics', 'Pragmatics',
  'Sociolinguistics', 'Psycholinguistics', 'Computational Linguistics',
  'Translation History', 'The Rosetta Stone',
  'Language Acquisition', 'Bilingualism', 'Constructed Languages',
  'Esperanto', 'Latin Language History', 'Ancient Greek Language',

  // ── EDUCATION ─────────────────────────────────────────────────
  'History of Education', 'Ancient Greek Education', 'Medieval Universities',
  'The Renaissance and Education', 'Public Education History',
  'The Enlightenment and Education', 'Progressive Education',
  'Montessori Method', 'Waldorf Education', 'John Dewey',
  'Education in the Industrial Revolution', 'Mass Literacy',
  'Higher Education History', 'Ivy League Universities',
  'Oxford and Cambridge History', 'STEM Education',
  'Online Education', 'MOOCs', 'Homeschooling',
  'Special Education', 'Educational Psychology',
  'Literacy and Education', 'Global Education Inequality',

  // ── TRANSPORTATION ────────────────────────────────────────────
  'History of Transportation', 'The Wheel', 'Horse and Carriage History',
  'Canal History', 'Railway History', 'The First Locomotives',
  'Aviation History', 'The Wright Brothers', 'Commercial Aviation',
  'Jet Engine History', 'Space Travel History', 'Automobile History',
  'Henry Ford and the Assembly Line', 'Electric Vehicle History',
  'Shipping History', 'The Suez Canal', 'The Panama Canal',
  'Road Building History', 'Highway Systems', 'Urban Transit Systems',
  'Subway History', 'High Speed Rail', 'Autonomous Vehicle Technology',
  'Hyperloop Technology', 'Drone Delivery',

  // ── ENERGY ────────────────────────────────────────────────────
  'History of Energy', 'The Discovery of Fire', 'Coal History',
  'Oil Discovery and History', 'The Oil Crisis 1973',
  'Natural Gas History', 'Nuclear Power History', 'Chernobyl',
  'Fukushima', 'Three Mile Island', 'The Energy Transition',
  'Solar Power History', 'Wind Power History',
  'Hydroelectric Power History', 'Biofuels',
  'Energy Storage Technology', 'Smart Grid',
  'Energy Policy', 'OPEC History', 'The Global Energy Market',

  // ── FAMOUS PEOPLE ─────────────────────────────────────────────
  'Albert Einstein', 'Isaac Newton', 'Charles Darwin',
  'Marie Curie', 'Nikola Tesla', 'Thomas Edison',
  'Stephen Hawking', 'Richard Feynman', 'Carl Sagan',
  'Neil deGrasse Tyson', 'Elon Musk', 'Steve Jobs',
  'Bill Gates', 'Jeff Bezos', 'Mark Zuckerberg',
  'Warren Buffett', 'George Soros', 'John D Rockefeller',
  'Andrew Carnegie', 'J P Morgan', 'Henry Ford',
  'Leonardo da Vinci', 'Michelangelo', 'Rembrandt',
  'Pablo Picasso', 'Vincent van Gogh', 'Claude Monet',
  'Wolfgang Amadeus Mozart', 'Ludwig van Beethoven',
  'Johann Sebastian Bach', 'William Shakespeare',
  'Homer', 'Dante Alighieri', 'Geoffrey Chaucer',
  'Jane Austen', 'Charles Dickens', 'Leo Tolstoy',
  'Fyodor Dostoevsky', 'Franz Kafka', 'James Joyce',
  'Ernest Hemingway', 'George Orwell', 'Gabriel García Márquez',
  'Alexander the Great', 'Julius Caesar', 'Augustus Caesar',
  'Cleopatra', 'Hannibal', 'Attila the Hun',
  'Charlemagne', 'William the Conqueror', 'Richard the Lionheart',
  'Saladin', 'Genghis Khan', 'Tamerlane',
  'Christopher Columbus', 'Vasco da Gama', 'Ferdinand Magellan',
  'Queen Elizabeth I', 'Queen Victoria', 'Catherine the Great',
  'Peter the Great', 'Frederick the Great', 'Napoleon Bonaparte',
  'George Washington', 'Thomas Jefferson', 'Benjamin Franklin',
  'Abraham Lincoln', 'Theodore Roosevelt', 'Franklin D Roosevelt',
  'Winston Churchill', 'Charles de Gaulle', 'Joseph Stalin',
  'Adolf Hitler', 'Mao Zedong', 'Ho Chi Minh',
  'Mahatma Gandhi', 'Jawaharlal Nehru', 'Nelson Mandela',
  'Simón Bolívar', 'Che Guevara', 'Fidel Castro',
  'Martin Luther King Jr', 'Malcolm X', 'Rosa Parks',
  'Sigmund Freud', 'Carl Jung', 'Jean Piaget',
  'Karl Marx', 'Friedrich Engels', 'Vladimir Lenin',
  'Leon Trotsky', 'Mao Zedong', 'Deng Xiaoping',
  'Confucius', 'Laozi', 'Siddhartha Gautama',
  'Muhammad', 'Jesus Christ', 'Moses',

  // ── GEOPOLITICS ───────────────────────────────────────────────
  'US China Relations', 'US Russia Relations', 'China Russia Relations',
  'NATO History and Role', 'The European Union History',
  'Brexit History', 'The Middle East Conflict',
  'The Israel Palestine Conflict', 'Kashmir Conflict',
  'South China Sea Dispute', 'Taiwan Strait',
  'The Korean Peninsula', 'Nuclear Proliferation',
  'The Nuclear Non Proliferation Treaty', 'Iran Nuclear Deal',
  'North Korea Nuclear Program', 'Arms Control Treaties',
  'Cybersecurity and Geopolitics', 'Information Warfare',
  'Energy Geopolitics', 'Water Wars', 'Climate Geopolitics',
  'Global Trade Wars', 'Sanctions as Foreign Policy',
  'Soft Power', 'Hard Power', 'Smart Power',
  'Belt and Road Initiative', 'US Foreign Policy History',
  'The Monroe Doctrine', 'The Truman Doctrine',
  'The Marshall Plan', 'Containment Policy',
  'Neocolonialism', 'Post Colonial Theory',

  // ── SOCIAL ISSUES ─────────────────────────────────────────────
  'Poverty and Inequality', 'Global Hunger', 'Child Labor',
  'Modern Slavery', 'Human Trafficking', 'Refugee Crisis',
  'Immigration and Asylum', 'Racism', 'Systemic Racism',
  'The Black Lives Matter Movement', 'Gender Inequality',
  'The Gender Pay Gap', 'Womens Suffrage History',
  'The MeToo Movement', 'LGBTQ Rights History',
  'Same Sex Marriage History', 'Transgender Rights',
  'Disability Rights', 'Mental Health Stigma',
  'Drug Policy and the War on Drugs', 'Prison Reform',
  'Capital Punishment', 'Police Brutality',
  'Corruption', 'Wealth Inequality', 'Universal Basic Income',
  'Healthcare Access', 'Universal Healthcare',
  'Housing Crisis', 'Homelessness', 'Food Deserts',
  'Digital Divide', 'Social Media and Mental Health',
  'Screen Addiction', 'Misinformation and Society',

  // ── INVENTIONS AND DISCOVERIES ────────────────────────────────
  'History of Writing', 'History of the Printing Press',
  'Johannes Gutenberg', 'History of the Telescope',
  'History of the Microscope', 'History of Electricity',
  'Benjamin Franklin and Electricity', 'History of the Telegraph',
  'History of the Telephone', 'Alexander Graham Bell',
  'History of Radio', 'History of Television',
  'History of the Computer', 'History of the Internet',
  'History of GPS', 'History of Photography',
  'History of the Airplane', 'History of the Automobile',
  'History of Nuclear Power', 'History of Antibiotics',
  'History of Vaccines', 'History of Anesthesia',
  'History of X Rays', 'History of DNA Discovery',
  'History of the Laser', 'History of the Transistor',
  'History of the Microchip', 'History of the Smartphone',
  'History of Social Media', 'History of Artificial Intelligence',

  // Europe
  'History of Albania', 'History of Andorra', 'History of Armenia',
  'History of Austria', 'History of Azerbaijan', 'History of Belarus',
  'History of Belgium', 'History of Bosnia and Herzegovina',
  'History of Bulgaria', 'History of Croatia', 'History of Cyprus',
  'History of Czech Republic', 'History of Denmark', 'History of Estonia',
  'History of Finland', 'History of France', 'History of Georgia',
  'History of Germany', 'History of Greece', 'History of Hungary',
  'History of Iceland', 'History of Ireland', 'History of Italy',
  'History of Kazakhstan', 'History of Kosovo', 'History of Latvia',
  'History of Liechtenstein', 'History of Lithuania', 'History of Luxembourg',
  'History of Malta', 'History of Moldova', 'History of Monaco',
  'History of Montenegro', 'History of Netherlands', 'History of North Macedonia',
  'History of Norway', 'History of Poland', 'History of Portugal',
  'History of Romania', 'History of Russia', 'History of San Marino',
  'History of Serbia', 'History of Slovakia', 'History of Slovenia',
  'History of Spain', 'History of Sweden', 'History of Switzerland',
  'History of Ukraine', 'History of United Kingdom', 'History of Vatican City',

  // Asia
  'History of Afghanistan', 'History of Bahrain', 'History of Bangladesh',
  'History of Bhutan', 'History of Brunei', 'History of Cambodia',
  'History of China', 'History of East Timor', 'History of India',
  'History of Indonesia', 'History of Iran', 'History of Iraq',
  'History of Israel', 'History of Japan', 'History of Jordan',
  'History of Kuwait', 'History of Kyrgyzstan', 'History of Laos',
  'History of Lebanon', 'History of Malaysia', 'History of Maldives',
  'History of Mongolia', 'History of Myanmar', 'History of Nepal',
  'History of North Korea', 'History of Oman', 'History of Pakistan',
  'History of Palestine', 'History of Philippines', 'History of Qatar',
  'History of Saudi Arabia', 'History of Singapore', 'History of South Korea',
  'History of Sri Lanka', 'History of Syria', 'History of Taiwan',
  'History of Tajikistan', 'History of Thailand', 'History of Turkmenistan',
  'History of United Arab Emirates', 'History of Uzbekistan',
  'History of Vietnam', 'History of Yemen',

  // Africa
  'History of Algeria', 'History of Angola', 'History of Benin',
  'History of Botswana', 'History of Burkina Faso', 'History of Burundi',
  'History of Cameroon', 'History of Cape Verde', 'History of Central African Republic',
  'History of Chad', 'History of Comoros', 'History of Congo',
  'History of Democratic Republic of Congo', 'History of Djibouti',
  'History of Egypt', 'History of Equatorial Guinea', 'History of Eritrea',
  'History of Ethiopia', 'History of Gabon', 'History of Gambia',
  'History of Ghana', 'History of Guinea', 'History of Guinea Bissau',
  'History of Ivory Coast', 'History of Kenya', 'History of Lesotho',
  'History of Liberia', 'History of Libya', 'History of Madagascar',
  'History of Malawi', 'History of Mali', 'History of Mauritania',
  'History of Mauritius', 'History of Morocco', 'History of Mozambique',
  'History of Namibia', 'History of Niger', 'History of Nigeria',
  'History of Rwanda', 'History of Sao Tome and Principe',
  'History of Senegal', 'History of Seychelles', 'History of Sierra Leone',
  'History of Somalia', 'History of South Africa', 'History of South Sudan',
  'History of Sudan', 'History of Swaziland', 'History of Tanzania',
  'History of Togo', 'History of Tunisia', 'History of Uganda',
  'History of Zambia', 'History of Zimbabwe',

  // Americas
  'History of Antigua and Barbuda', 'History of Argentina', 'History of Bahamas',
  'History of Barbados', 'History of Belize', 'History of Bolivia',
  'History of Brazil', 'History of Canada', 'History of Chile',
  'History of Colombia', 'History of Costa Rica', 'History of Cuba',
  'History of Dominica', 'History of Dominican Republic', 'History of Ecuador',
  'History of El Salvador', 'History of Grenada', 'History of Guatemala',
  'History of Guyana', 'History of Haiti', 'History of Honduras',
  'History of Jamaica', 'History of Mexico', 'History of Nicaragua',
  'History of Panama', 'History of Paraguay', 'History of Peru',
  'History of Saint Kitts and Nevis', 'History of Saint Lucia',
  'History of Saint Vincent and the Grenadines', 'History of Suriname',
  'History of Trinidad and Tobago', 'History of United States',
  'History of Uruguay', 'History of Venezuela',

  // Oceania
  'History of Australia', 'History of Fiji', 'History of Kiribati',
  'History of Marshall Islands', 'History of Micronesia',
  'History of Nauru', 'History of New Zealand', 'History of Palau',
  'History of Papua New Guinea', 'History of Samoa',
  'History of Solomon Islands', 'History of Tonga', 'History of Tuvalu',
  'History of Vanuatu',

  // Europe
  'London', 'Paris', 'Berlin', 'Madrid', 'Rome', 'Amsterdam',
  'Brussels', 'Vienna', 'Zurich', 'Stockholm', 'Oslo', 'Copenhagen',
  'Helsinki', 'Athens', 'Lisbon', 'Warsaw', 'Prague', 'Budapest',
  'Bucharest', 'Sofia', 'Belgrade', 'Zagreb', 'Kyiv', 'Minsk',
  'Riga', 'Vilnius', 'Tallinn', 'Ljubljana', 'Bratislava',
  'Sarajevo', 'Tirana', 'Skopje', 'Podgorica', 'Chisinau',
  'Reykjavik', 'Monaco', 'Vaduz', 'San Marino', 'Valletta',
  'Manchester', 'Birmingham', 'Glasgow', 'Edinburgh', 'Dublin',
  'Lyon', 'Marseille', 'Barcelona', 'Seville', 'Valencia',
  'Milan', 'Naples', 'Turin', 'Florence', 'Venice',
  'Hamburg', 'Munich', 'Frankfurt', 'Cologne', 'Stuttgart',
  'Rotterdam', 'The Hague', 'Antwerp', 'Ghent',

  // Asia
  'Tokyo', 'Beijing', 'Shanghai', 'Mumbai', 'Delhi', 'Dhaka',
  'Karachi', 'Istanbul', 'Tehran', 'Baghdad', 'Riyadh',
  'Dubai', 'Abu Dhabi', 'Doha', 'Kuwait City', 'Muscat',
  'Amman', 'Beirut', 'Damascus', 'Jerusalem', 'Tel Aviv',
  'Kabul', 'Islamabad', 'Lahore', 'Colombo', 'Kathmandu',
  'Thimphu', 'Dhaka', 'Rangoon', 'Bangkok', 'Kuala Lumpur',
  'Singapore', 'Jakarta', 'Manila', 'Hanoi', 'Ho Chi Minh City',
  'Phnom Penh', 'Vientiane', 'Naypyidaw', 'Seoul', 'Pyongyang',
  'Taipei', 'Hong Kong', 'Macau', 'Ulaanbaatar', 'Tashkent',
  'Almaty', 'Astana', 'Bishkek', 'Dushanbe', 'Ashgabat',
  'Baku', 'Tbilisi', 'Yerevan', 'Colombo', 'Male',
  'Osaka', 'Kyoto', 'Hiroshima', 'Nagoya', 'Fukuoka',
  'Chengdu', 'Guangzhou', 'Shenzhen', 'Wuhan', 'Chongqing',
  'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune',

  // Africa
  'Cairo', 'Lagos', 'Kinshasa', 'Johannesburg', 'Nairobi',
  'Dar es Salaam', 'Luanda', 'Khartoum', 'Abidjan', 'Accra',
  'Addis Ababa', 'Dakar', 'Casablanca', 'Rabat', 'Tunis',
  'Algiers', 'Tripoli', 'Kampala', 'Lusaka', 'Harare',
  'Maputo', 'Antananarivo', 'Kigali', 'Bamako', 'Conakry',
  'Freetown', 'Monrovia', 'Ouagadougou', 'Niamey', 'Ndjamena',
  'Bangui', 'Libreville', 'Brazzaville', 'Yaoundé', 'Douala',
  'Cape Town', 'Durban', 'Pretoria', 'Mombasa', 'Zanzibar',
  'Timbuktu', 'Marrakech',

  // Americas
  'New York City', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
  'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
  'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte',
  'Indianapolis', 'San Francisco', 'Seattle', 'Denver', 'Nashville',
  'Boston', 'Detroit', 'Memphis', 'Portland', 'Las Vegas',
  'Washington DC', 'Miami', 'Atlanta', 'Minneapolis', 'New Orleans',
  'Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa',
  'Mexico City', 'Guadalajara', 'Monterrey', 'São Paulo',
  'Rio de Janeiro', 'Brasilia', 'Salvador', 'Buenos Aires',
  'Cordoba', 'Rosario', 'Lima', 'Bogotá', 'Medellín',
  'Cali', 'Santiago', 'Caracas', 'Quito', 'La Paz',
  'Montevideo', 'Asuncion', 'Havana', 'Port au Prince',
  'Santo Domingo', 'San Juan', 'Kingston', 'Guatemala City',
  'Tegucigalpa', 'San Salvador', 'Managua', 'San Jose',
  'Panama City',

  // Oceania
  'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide',
  'Auckland', 'Wellington', 'Christchurch',
  'Battle of Marathon', 'Battle of Thermopylae', 'Battle of Salamis',
  'Battle of Plataea', 'Battle of Gaugamela', 'Battle of the Hydaspes',
  'Battle of Cannae', 'Battle of Zama', 'Battle of Actium',
  'Battle of Teutoburg Forest', 'Battle of Milvian Bridge',
  'Battle of Adrianople', 'Battle of Tours', 'Battle of Hastings',
  'Battle of Manzikert', 'Battle of Hattin', 'Battle of Ain Jalut',
  'Battle of Agincourt', 'Battle of Constantinople 1453',
  'Battle of Lepanto', 'Battle of the Spanish Armada',
  'Battle of White Mountain', 'Battle of Blenheim',
  'Battle of Poltava', 'Battle of Plassey', 'Battle of Quebec',
  'Battle of Bunker Hill', 'Battle of Saratoga', 'Battle of Yorktown',
  'Battle of the Nile', 'Battle of Trafalgar', 'Battle of Austerlitz',
  'Battle of Jena', 'Battle of Borodino', 'Battle of Leipzig',
  'Battle of Waterloo', 'Battle of Gettysburg', 'Battle of Antietam',
  'Battle of Sedan 1870', 'Battle of Tsushima', 'Battle of the Marne',
  'Battle of Verdun', 'Battle of the Somme', 'Battle of Passchendaele',
  'Battle of Gallipoli', 'Battle of Jutland', 'Battle of Britain',
  'Battle of Moscow', 'Battle of Stalingrad', 'Battle of Kursk',
  'Battle of El Alamein', 'Battle of Midway', 'Battle of Guadalcanal',
  'Battle of Normandy D Day', 'Battle of the Bulge', 'Battle of Berlin',
  'Battle of Iwo Jima', 'Battle of Okinawa', 'Battle of Inchon',
  'Battle of Dien Bien Phu', 'Battle of Ia Drang', 'Battle of Hue',
  'Battle of Khe Sanh', 'Battle of the Six Day War', 'Battle of Fallujah',
  'Siege of Jerusalem', 'Siege of Carthage', 'Siege of Constantinople',
  'Siege of Vienna', 'Siege of Leningrad', 'Siege of Sarajevo',

  // Ancient battles
  'Battle of Megiddo', 'Battle of Kadesh', 'Battle of Troy',
  'Battle of Leuctra', 'Battle of Chaeronea', 'Battle of Issus',
  'Battle of the Persian Gates', 'Battle of Raphia',
  'Battle of Magnesia', 'Battle of Pydna', 'Battle of Pharsalus',

  'George Washington President', 'John Adams President',
  'Thomas Jefferson President', 'James Madison President',
  'James Monroe President', 'John Quincy Adams President',
  'Andrew Jackson President', 'Martin Van Buren President',
  'William Henry Harrison President', 'John Tyler President',
  'James K Polk President', 'Zachary Taylor President',
  'Millard Fillmore President', 'Franklin Pierce President',
  'James Buchanan President', 'Abraham Lincoln President',
  'Andrew Johnson President', 'Ulysses S Grant President',
  'Rutherford B Hayes President', 'James A Garfield President',
  'Chester A Arthur President', 'Grover Cleveland President',
  'Benjamin Harrison President', 'William McKinley President',
  'Theodore Roosevelt President', 'William Howard Taft President',
  'Woodrow Wilson President', 'Warren G Harding President',
  'Calvin Coolidge President', 'Herbert Hoover President',
  'Franklin D Roosevelt President', 'Harry S Truman President',
  'Dwight D Eisenhower President', 'John F Kennedy President',
  'Lyndon B Johnson President', 'Richard Nixon President',
  'Gerald Ford President', 'Jimmy Carter President',
  'Ronald Reagan President', 'George H W Bush President',
  'Bill Clinton President', 'George W Bush President',
  'Barack Obama President', 'Donald Trump President',
  'Joe Biden President',

  // UK Prime Ministers
  'Robert Walpole Prime Minister', 'William Pitt the Younger Prime Minister',
  'Duke of Wellington Prime Minister', 'Robert Peel Prime Minister',
  'Benjamin Disraeli Prime Minister', 'William Gladstone Prime Minister',
  'Lord Salisbury Prime Minister', 'Arthur Balfour Prime Minister',
  'Herbert Asquith Prime Minister', 'David Lloyd George Prime Minister',
  'Andrew Bonar Law Prime Minister', 'Stanley Baldwin Prime Minister',
  'Ramsay MacDonald Prime Minister', 'Neville Chamberlain Prime Minister',
  'Winston Churchill Prime Minister', 'Clement Attlee Prime Minister',
  'Anthony Eden Prime Minister', 'Harold Macmillan Prime Minister',
  'Alec Douglas Home Prime Minister', 'Harold Wilson Prime Minister',
  'Edward Heath Prime Minister', 'James Callaghan Prime Minister',
  'Margaret Thatcher Prime Minister', 'John Major Prime Minister',
  'Tony Blair Prime Minister', 'Gordon Brown Prime Minister',
  'David Cameron Prime Minister', 'Theresa May Prime Minister',
  'Boris Johnson Prime Minister', 'Liz Truss Prime Minister',
  'Rishi Sunak Prime Minister', 'Keir Starmer Prime Minister',

  // Infectious diseases
  'Malaria', 'Tuberculosis', 'HIV AIDS', 'Influenza', 'COVID-19',
  'Smallpox', 'Cholera', 'Typhoid Fever', 'Yellow Fever',
  'Dengue Fever', 'Zika Virus', 'Ebola Virus', 'Rabies',
  'Polio', 'Measles', 'Mumps', 'Rubella', 'Chickenpox',
  'Hepatitis A', 'Hepatitis B', 'Hepatitis C', 'Leprosy',
  'Plague', 'Bubonic Plague', 'Typhus', 'Syphilis', 'Gonorrhea',
  'Chlamydia', 'Herpes', 'HPV', 'Norovirus', 'Rotavirus',
  'Meningitis', 'Pneumonia', 'Bronchitis', 'Whooping Cough',
  'Diphtheria', 'Tetanus', 'Botulism', 'Salmonella',
  'E Coli Infection', 'Listeria', 'Cryptosporidiosis',
  'Giardia', 'Toxoplasmosis', 'Leishmaniasis', 'Trypanosomiasis',
  'Schistosomiasis', 'River Blindness', 'Elephantiasis',
  'Ringworm', 'Athletes Foot', 'Candidiasis', 'Aspergillosis',
  'Lyme Disease', 'Rocky Mountain Spotted Fever',
  'West Nile Virus', 'SARS', 'MERS', 'Monkeypox',

  // Non-infectious diseases
  'Heart Disease', 'Coronary Artery Disease', 'Heart Attack',
  'Heart Failure', 'Stroke', 'Hypertension', 'Atherosclerosis',
  'Lung Cancer', 'Breast Cancer', 'Prostate Cancer', 'Colon Cancer',
  'Leukemia', 'Lymphoma', 'Melanoma', 'Pancreatic Cancer',
  'Ovarian Cancer', 'Cervical Cancer', 'Stomach Cancer',
  'Liver Cancer', 'Brain Cancer', 'Bladder Cancer',
  'Type 1 Diabetes', 'Type 2 Diabetes', 'Gestational Diabetes',
  'Alzheimers Disease', 'Parkinsons Disease', 'Multiple Sclerosis',
  'Amyotrophic Lateral Sclerosis ALS', 'Epilepsy',
  'Migraines', 'Chronic Pain', 'Fibromyalgia',
  'Rheumatoid Arthritis', 'Osteoarthritis', 'Osteoporosis',
  'Lupus', 'Crohns Disease', 'Ulcerative Colitis',
  'Irritable Bowel Syndrome', 'Celiac Disease',
  'Asthma', 'COPD', 'Emphysema', 'Pulmonary Fibrosis',
  'Kidney Disease', 'Kidney Stones', 'Urinary Tract Infection',
  'Liver Cirrhosis', 'Fatty Liver Disease', 'Gallstones',
  'Anemia', 'Sickle Cell Disease', 'Hemophilia', 'Thalassemia',
  'Hypothyroidism', 'Hyperthyroidism', 'Addisons Disease',
  'Cushings Syndrome', 'Polycystic Ovary Syndrome',
  'Endometriosis', 'Infertility',
  'Down Syndrome', 'Cystic Fibrosis', 'Huntingtons Disease',
  'Marfan Syndrome', 'Muscular Dystrophy',
  'Autism Spectrum Disorder', 'ADHD', 'Schizophrenia',
  'Bipolar Disorder', 'Depression', 'Anxiety Disorders',
  'PTSD', 'OCD', 'Eating Disorders', 'Addiction',
  'Macular Degeneration', 'Glaucoma', 'Cataracts',
  'Hearing Loss', 'Tinnitus',

  // Tech
  'Apple Inc History', 'Microsoft History', 'Google History',
  'Amazon History', 'Meta Facebook History', 'Tesla History',
  'Netflix History', 'Nvidia History', 'Intel History',
  'IBM History', 'Oracle History', 'Salesforce History',
  'Adobe History', 'Uber History', 'Airbnb History',
  'Twitter X History', 'Snapchat History', 'LinkedIn History',
  'Spotify History', 'PayPal History', 'eBay History',
  'Yahoo History', 'AOL History', 'Myspace History',
  'Samsung History', 'Sony History', 'LG History',
  'Panasonic History', 'Toshiba History', 'Hitachi History',
  'Huawei History', 'Xiaomi History', 'TSMC History',
  'Qualcomm History', 'AMD History', 'ARM Holdings History',
  'Cisco History', 'Dell History', 'HP History',
  'Lenovo History', 'Asus History', 'Acer History',
  'Dropbox History', 'Slack History', 'Zoom History',
  'Shopify History', 'Square Block History', 'Stripe History',
  'Palantir History', 'SpaceX History', 'OpenAI History',
  'DeepMind History', 'Anthropic History',

  // Finance
  'JPMorgan Chase History', 'Goldman Sachs History',
  'Bank of America History', 'Wells Fargo History',
  'Citigroup History', 'Morgan Stanley History',
  'Barclays History', 'HSBC History', 'Deutsche Bank History',
  'BNP Paribas History', 'UBS History', 'Credit Suisse History',
  'BlackRock History', 'Vanguard History', 'Fidelity History',
  'Berkshire Hathaway History', 'AIG History',
  'Visa History', 'Mastercard History', 'American Express History',

  // Retail and Consumer
  'Walmart History', 'Costco History', 'Target History',
  'Home Depot History', 'IKEA History', 'H and M History',
  'Zara Inditex History', 'Nike History', 'Adidas History',
  'Puma History', 'Under Armour History', 'Levi Strauss History',
  'Coca Cola History', 'PepsiCo History', 'Nestle History',
  'Unilever History', 'Procter and Gamble History',
  'Johnson and Johnson History', 'Pfizer History',
  'Novartis History', 'Roche History', 'AstraZeneca History',
  'Moderna History', 'BioNTech History',
  'McDonalds History', 'Starbucks History', 'KFC History',
  'Subway History', 'Burger King History', 'Pizza Hut History',

  // Energy and Industrial
  'ExxonMobil History', 'Shell History', 'BP History',
  'Chevron History', 'TotalEnergies History', 'Saudi Aramco History',
  'General Electric History', 'Siemens History', 'ABB History',
  'Boeing History', 'Airbus History', 'Lockheed Martin History',
  'Raytheon History', 'Northrop Grumman History',
  'Ford Motor History', 'General Motors History',
  'Toyota History', 'Volkswagen History', 'BMW History',
  'Mercedes Benz History', 'Honda History', 'Hyundai History',
  'Ferrari History', 'Lamborghini History', 'Porsche History',

  // Media
  'Disney History', 'Warner Bros History', 'Universal Pictures History',
  'Paramount History', 'Sony Pictures History', 'NBCUniversal History',
  'News Corp History', 'New York Times History', 'BBC History',
  'CNN History', 'Fox News History', 'Reuters History',
  'Associated Press History', 'Bloomberg History',

  'Zeus Greek God', 'Hera Greek Goddess', 'Poseidon Greek God',
  'Demeter Greek Goddess', 'Athena Greek Goddess', 'Apollo Greek God',
  'Artemis Greek Goddess', 'Ares Greek God', 'Aphrodite Greek Goddess',
  'Hephaestus Greek God', 'Hermes Greek God', 'Dionysus Greek God',
  'Hades Greek God', 'Persephone Greek Goddess', 'Hestia Greek Goddess',
  'Eros Greek God', 'Nike Greek Goddess', 'Tyche Greek Goddess',
  'Nemesis Greek Goddess', 'Nyx Greek Goddess', 'Gaia Greek Goddess',
  'Prometheus Greek Titan', 'Atlas Greek Titan', 'Cronos Greek Titan',
  'Heracles Hercules', 'Achilles Greek Hero', 'Odysseus Greek Hero',
  'Perseus Greek Hero', 'Theseus Greek Hero', 'Jason and the Argonauts',
  'Orpheus Greek Myth', 'Oedipus Greek Myth', 'Antigone Greek Myth',
  'Medusa Greek Myth', 'The Minotaur Greek Myth', 'Icarus Greek Myth',
  'Sisyphus Greek Myth', 'Tantalus Greek Myth', 'Narcissus Greek Myth',
  'Echo Greek Myth', 'Pandoras Box', 'The Trojan Horse',
  'The Odyssey Summary', 'The Iliad Summary',
  'The Twelve Labors of Hercules', 'The Golden Fleece',

  // Roman mythology
  'Jupiter Roman God', 'Juno Roman Goddess', 'Neptune Roman God',
  'Mars Roman God', 'Venus Roman Goddess', 'Minerva Roman Goddess',
  'Mercury Roman God', 'Diana Roman Goddess', 'Vulcan Roman God',
  'Bacchus Roman God', 'Pluto Roman God', 'Ceres Roman Goddess',
  'Janus Roman God', 'Saturn Roman God', 'Cupid Roman God',
  'Aurora Roman Goddess', 'Luna Roman Goddess', 'Sol Roman God',

  // Norse mythology
  'Odin Norse God', 'Thor Norse God', 'Loki Norse God',
  'Freya Norse Goddess', 'Baldur Norse God', 'Tyr Norse God',
  'Heimdall Norse God', 'Frigg Norse Goddess', 'Hel Norse Goddess',
  'Fenrir Norse Myth', 'Jormungandr Norse Myth', 'Yggdrasil Norse Myth',
  'Asgard Norse Mythology', 'Valhalla Norse Mythology',
  'Ragnarok Norse Mythology', 'The Valkyries', 'Viking Afterlife',

  // Egyptian mythology
  'Ra Egyptian God', 'Osiris Egyptian God', 'Isis Egyptian Goddess',
  'Horus Egyptian God', 'Set Egyptian God', 'Anubis Egyptian God',
  'Thoth Egyptian God', 'Bastet Egyptian Goddess',
  'Sekhmet Egyptian Goddess', 'Hathor Egyptian Goddess',
  'Ptah Egyptian God', 'Amun Egyptian God', 'Nut Egyptian Goddess',
  'Geb Egyptian God', 'Nephthys Egyptian Goddess',
  'The Egyptian Book of the Dead', 'Egyptian Afterlife Beliefs',

  // Hindu mythology
  'Brahma Hindu God', 'Vishnu Hindu God', 'Shiva Hindu God',
  'Saraswati Hindu Goddess', 'Lakshmi Hindu Goddess', 'Parvati Hindu Goddess',
  'Durga Hindu Goddess', 'Kali Hindu Goddess', 'Ganesha Hindu God',
  'Hanuman Hindu God', 'Indra Hindu God', 'Krishna Hindu God',
  'Rama Hindu God', 'The Ramayana', 'The Mahabharata',

  'Classical Music History', 'Baroque Music', 'Romantic Music Era',
  'Opera History', 'Chamber Music', 'Symphony History',
  'Jazz History', 'Bebop Jazz', 'Cool Jazz', 'Free Jazz',
  'Fusion Jazz', 'Smooth Jazz', 'Blues History', 'Delta Blues',
  'Chicago Blues', 'Electric Blues', 'Rock and Roll History',
  'Classic Rock', 'Hard Rock', 'Heavy Metal History',
  'Death Metal', 'Black Metal', 'Thrash Metal', 'Doom Metal',
  'Punk Rock History', 'New Wave Music', 'Post Punk',
  'Alternative Rock', 'Indie Rock', 'Grunge History',
  'Pop Music History', 'Bubblegum Pop', 'Synthpop',
  'Dance Pop', 'K Pop History', 'J Pop History',
  'Hip Hop History', 'East Coast Hip Hop', 'West Coast Hip Hop',
  'Trap Music', 'Drill Music', 'Gangsta Rap',
  'R and B History', 'Soul Music History', 'Funk Music History',
  'Gospel Music History', 'Reggae History', 'Ska History',
  'Dancehall Music', 'Afrobeats History', 'Highlife Music',
  'Electronic Music History', 'House Music History',
  'Techno Music History', 'Trance Music', 'Drum and Bass',
  'Dubstep History', 'EDM History', 'Ambient Music',
  'Country Music History', 'Bluegrass Music', 'Folk Music History',
  'American Folk Revival', 'Celtic Music', 'Flamenco History',
  'Bossa Nova History', 'Samba History', 'Tango History',
  'Cumbia Music', 'Salsa Music History', 'Latin Jazz',
  'Bollywood Music', 'Qawwali Music', 'Indian Classical Music',
  'World Music', 'Traditional African Music', 'Arabic Music',
  'Turkish Classical Music', 'Persian Classical Music',


  'Johann Sebastian Bach', 'Wolfgang Amadeus Mozart', 'Ludwig van Beethoven',
  'Franz Schubert', 'Frederic Chopin', 'Robert Schumann',
  'Franz Liszt', 'Johannes Brahms', 'Richard Wagner',
  'Giuseppe Verdi', 'Giacomo Puccini', 'Hector Berlioz',
  'Pyotr Ilyich Tchaikovsky', 'Sergei Rachmaninoff',
  'Igor Stravinsky', 'Claude Debussy', 'Maurice Ravel',
  'Gustav Mahler', 'Anton Bruckner', 'Richard Strauss',
  'Dmitri Shostakovich', 'Sergei Prokofiev', 'Aaron Copland',
  'George Gershwin', 'Leonard Bernstein', 'Philip Glass',
  'Arvo Part', 'Henryk Gorecki', 'John Adams Composer',
  'Antonio Vivaldi', 'George Frideric Handel', 'Henry Purcell',
  'Domenico Scarlatti', 'Joseph Haydn', 'Carl Philipp Emanuel Bach',

  // Ancient
  'The Iliad Homer', 'The Odyssey Homer', 'The Aeneid Virgil',
  'The Epic of Gilgamesh', 'The Mahabharata', 'The Ramayana',
  'The Vedas', 'The Upanishads', 'The Bhagavad Gita',
  'The Book of Job Bible', 'The Psalms Bible', 'The Quran',
  'The Torah', 'Tao Te Ching', 'The Analects of Confucius',
  'The Art of War Sun Tzu', 'Oedipus Rex Sophocles',
  'Antigone Sophocles', 'The Oresteia Aeschylus',
  'The Clouds Aristophanes', 'The Republic Plato',
  'Nicomachean Ethics Aristotle', 'Meditations Marcus Aurelius',

  // Medieval
  'The Divine Comedy Dante', 'The Canterbury Tales Chaucer',
  'Beowulf', 'The Song of Roland', 'Le Morte d Arthur',
  'The Tale of Genji', 'One Thousand and One Nights',
  'The Decameron Boccaccio', 'Don Quixote Cervantes',
  'The Prince Machiavelli',

  // Shakespeare
  'Hamlet Shakespeare', 'Macbeth Shakespeare', 'Othello Shakespeare',
  'King Lear Shakespeare', 'Romeo and Juliet Shakespeare',
  'A Midsummer Night Dream Shakespeare', 'The Tempest Shakespeare',
  'Merchant of Venice Shakespeare', 'Much Ado About Nothing Shakespeare',
  'Richard III Shakespeare', 'Julius Caesar Shakespeare',
  'Antony and Cleopatra Shakespeare',

  // 18th and 19th century
  'Paradise Lost John Milton', 'Robinson Crusoe Daniel Defoe',
  'Gullivers Travels Jonathan Swift', 'Tom Jones Henry Fielding',
  'Candide Voltaire', 'The Social Contract Rousseau',
  'Pride and Prejudice Jane Austen', 'Sense and Sensibility Jane Austen',
  'Emma Jane Austen', 'Northanger Abbey Jane Austen',
  'Frankenstein Mary Shelley', 'Wuthering Heights Emily Bronte',
  'Jane Eyre Charlotte Bronte', 'Oliver Twist Charles Dickens',
  'A Tale of Two Cities Charles Dickens', 'Great Expectations Charles Dickens',
  'David Copperfield Charles Dickens', 'Bleak House Charles Dickens',
  'Middlemarch George Eliot', 'The Mill on the Floss George Eliot',
  'Treasure Island Robert Louis Stevenson',
  'Strange Case of Dr Jekyll and Mr Hyde',
  'The Picture of Dorian Gray Oscar Wilde',
  'Adventures of Huckleberry Finn Mark Twain',
  'The Adventures of Tom Sawyer Mark Twain',
  'Moby Dick Herman Melville', 'The Scarlet Letter Nathaniel Hawthorne',
  'Leaves of Grass Walt Whitman', 'Poems Emily Dickinson',
  'War and Peace Leo Tolstoy', 'Anna Karenina Leo Tolstoy',
  'Crime and Punishment Dostoevsky',
  'The Brothers Karamazov Dostoevsky',
  'The Idiot Dostoevsky', 'Notes from Underground Dostoevsky',
  'Dead Souls Gogol', 'Fathers and Sons Turgenev',
  'Madame Bovary Flaubert', 'Les Miserables Victor Hugo',
  'The Hunchback of Notre Dame Victor Hugo',
  'The Count of Monte Cristo Alexandre Dumas',
  'The Three Musketeers Alexandre Dumas',
  'Germinal Emile Zola', 'Nana Emile Zola',

  // 20th century
  'Ulysses James Joyce', 'Dubliners James Joyce',
  'Mrs Dalloway Virginia Woolf', 'To the Lighthouse Virginia Woolf',
  'The Waste Land T S Eliot', 'The Great Gatsby F Scott Fitzgerald',
  'Tender is the Night F Scott Fitzgerald',
  'The Sun Also Rises Ernest Hemingway',
  'A Farewell to Arms Ernest Hemingway',
  'For Whom the Bell Tolls Ernest Hemingway',
  'The Old Man and the Sea Ernest Hemingway',
  'Of Mice and Men John Steinbeck',
  'The Grapes of Wrath John Steinbeck',
  'East of Eden John Steinbeck',
  'In Search of Lost Time Marcel Proust',
  'The Trial Franz Kafka', 'The Metamorphosis Franz Kafka',
  'The Castle Franz Kafka', 'Brave New World Aldous Huxley',
  'Nineteen Eighty Four George Orwell',
  'Animal Farm George Orwell',
  'Lord of the Flies William Golding',
  'The Catcher in the Rye J D Salinger',
  'To Kill a Mockingbird Harper Lee',
  'One Hundred Years of Solitude Garcia Marquez',
  'Love in the Time of Cholera Garcia Marquez',
  'Lolita Vladimir Nabokov', 'Pale Fire Vladimir Nabokov',
  'The Stranger Albert Camus', 'The Plague Albert Camus',
  'Nausea Jean Paul Sartre', 'Waiting for Godot Samuel Beckett',
  'Invisible Man Ralph Ellison', 'Native Son Richard Wright',
  'Their Eyes Were Watching God Zora Neale Hurston',
  'Beloved Toni Morrison', 'The Color Purple Alice Walker',
  'Catch-22 Joseph Heller', 'Slaughterhouse Five Kurt Vonnegut',
  'Fahrenheit 451 Ray Bradbury', 'The Handmaids Tale Margaret Atwood',
  'Blood Meridian Cormac McCarthy', 'The Road Cormac McCarthy',
  'Infinite Jest David Foster Wallace',
  'The Lord of the Rings JRR Tolkien',
  'The Hobbit JRR Tolkien', 'The Chronicles of Narnia CS Lewis',
  'Harry Potter Series JK Rowling',
  'Dune Frank Herbert',
  'Foundation Series Isaac Asimov',
  'Neuromancer William Gibson',
  'Do Androids Dream of Electric Sheep Philip K Dick',

  'Nile River', 'Amazon River', 'Yangtze River', 'Mississippi River',
  'Yenisei River', 'Yellow River Huang He', 'Ob River', 'Congo River',
  'Amur River', 'Lena River', 'Mekong River', 'Mackenzie River',
  'Niger River', 'Volga River', 'Murray Darling River',
  'Danube River', 'Rio Grande', 'Indus River', 'Ganges River',
  'Euphrates River', 'Tigris River', 'Rhine River', 'Elbe River',
  'Loire River', 'Rhone River', 'Seine River', 'Thames River',
  'Zambezi River', 'Orange River', 'Limpopo River', 'Okavango River',
  'Orinoco River', 'Parana River', 'Uruguay River', 'Tocantins River',
  'Columbia River', 'Colorado River', 'Missouri River', 'Ohio River',
  'St Lawrence River', 'Yukon River', 'Irrawaddy River',
  'Salween River', 'Brahmaputra River', 'Krishna River',
  'Godavari River', 'Mahanadi River', 'Cauvery River',
  'Amu Darya River', 'Syr Darya River', 'Ural River',
  'Don River Russia', 'Dnieper River', 'Dniester River',
  'Wisla River', 'Oder River', 'Vistula River',

  'Mount Everest', 'K2', 'Kangchenjunga', 'Lhotse', 'Makalu',
  'Cho Oyu', 'Dhaulagiri', 'Manaslu', 'Nanga Parbat', 'Annapurna',
  'Gasherbrum', 'Broad Peak', 'The Himalayas', 'The Karakoram',
  'The Hindu Kush', 'The Pamirs', 'The Tian Shan',
  'Mont Blanc', 'Monte Rosa', 'Matterhorn', 'Eiger',
  'The Alps Mountain Range', 'The Pyrenees', 'The Carpathians',
  'The Caucasus Mountains', 'The Urals', 'The Scandinavian Mountains',
  'Mount Elbrus', 'Mount Kilimanjaro', 'Mount Kenya',
  'The Rwenzori Mountains', 'The Atlas Mountains',
  'The Drakensberg', 'The Ethiopian Highlands',
  'Mount McKinley Denali', 'Mount Logan', 'Pico de Orizaba',
  'The Rocky Mountains', 'The Sierra Nevada', 'The Appalachians',
  'The Andes Mountain Range', 'Aconcagua', 'Ojos del Salado',
  'Monte Pissis', 'Huascaran', 'Chimborazo', 'Cotopaxi',
  'Mount Cook New Zealand', 'Mount Wilhelm Papua New Guinea',
  'Puncak Jaya', 'Mount Fuji', 'Mount Olympus',
  'Table Mountain', 'The Blue Mountains',
  'The Great Dividing Range', 'The Cascade Range',
  'The Coast Ranges', 'The Brooks Range',

  // Physics
  'Wilhelm Röntgen Nobel Prize Physics', 'Marie Curie Nobel Prize Physics',
  'Albert Einstein Nobel Prize Physics', 'Niels Bohr Nobel Prize Physics',
  'Werner Heisenberg Nobel Prize Physics', 'Erwin Schrödinger Nobel Prize Physics',
  'Paul Dirac Nobel Prize Physics', 'Enrico Fermi Nobel Prize Physics',
  'Max Planck Nobel Prize Physics', 'Richard Feynman Nobel Prize Physics',
  'Murray Gell-Mann Nobel Prize Physics', 'Peter Higgs Nobel Prize Physics',
  'Stephen Hawking Physics', 'Roger Penrose Nobel Prize Physics',

  // Chemistry
  'Marie Curie Nobel Prize Chemistry', 'Linus Pauling Nobel Prize Chemistry',
  'Frederick Sanger Nobel Prize Chemistry',
  'Dorothy Hodgkin Nobel Prize Chemistry',

  // Medicine
  'Alexander Fleming Nobel Prize Medicine',
  'James Watson Nobel Prize Medicine', 'Francis Crick Nobel Prize Medicine',
  'Rosalind Franklin DNA Discovery',
  'Christiaan Barnard Heart Transplant',

  // Literature
  'Rabindranath Tagore Nobel Prize Literature',
  'William Butler Yeats Nobel Prize Literature',
  'George Bernard Shaw Nobel Prize Literature',
  'Thomas Mann Nobel Prize Literature',
  'Ernest Hemingway Nobel Prize Literature',
  'Albert Camus Nobel Prize Literature',
  'Samuel Beckett Nobel Prize Literature',
  'Pablo Neruda Nobel Prize Literature',
  'Gabriel Garcia Marquez Nobel Prize Literature',
  'Toni Morrison Nobel Prize Literature',
  'Doris Lessing Nobel Prize Literature',
  'Gunter Grass Nobel Prize Literature',
  'Seamus Heaney Nobel Prize Literature',
  'Harold Pinter Nobel Prize Literature',
  'Mario Vargas Llosa Nobel Prize Literature',
  'Mo Yan Nobel Prize Literature',
  'Alice Munro Nobel Prize Literature',
  'Patrick Modiano Nobel Prize Literature',
  'Svetlana Alexievich Nobel Prize Literature',
  'Bob Dylan Nobel Prize Literature',
  'Kazuo Ishiguro Nobel Prize Literature',
  'Olga Tokarczuk Nobel Prize Literature',
  'Peter Handke Nobel Prize Literature',
  'Abdulrazak Gurnah Nobel Prize Literature',
  'Annie Ernaux Nobel Prize Literature',

  // Peace
  'Henri Dunant Nobel Peace Prize',
  'Theodore Roosevelt Nobel Peace Prize',
  'Woodrow Wilson Nobel Peace Prize',
  'Albert Schweitzer Nobel Peace Prize',
  'Martin Luther King Jr Nobel Peace Prize',
  'Mother Teresa Nobel Peace Prize',
  'Anwar Sadat Nobel Peace Prize',
  'Menachem Begin Nobel Peace Prize',
  'Lech Walesa Nobel Peace Prize',
  'Desmond Tutu Nobel Peace Prize',
  'Nelson Mandela Nobel Peace Prize',
  'Yasser Arafat Nobel Peace Prize',
  'Yitzhak Rabin Nobel Peace Prize',
  'Kofi Annan Nobel Peace Prize',
  'Barack Obama Nobel Peace Prize',
  'Liu Xiaobo Nobel Peace Prize',
  'Malala Yousafzai Nobel Peace Prize',
  'ICAN Nobel Peace Prize',

  // Economics
  'Milton Friedman Nobel Economics',
  'Friedrich Hayek Nobel Economics',
  'Paul Samuelson Nobel Economics',
  'Kenneth Arrow Nobel Economics',
  'John Nash Nobel Economics',
  'Gary Becker Nobel Economics',
  'Robert Solow Nobel Economics',
  'Amartya Sen Nobel Economics',
  'Joseph Stiglitz Nobel Economics',
  'Daniel Kahneman Nobel Economics',
  'Paul Krugman Nobel Economics',
  'Elinor Ostrom Nobel Economics',
  'Angus Deaton Nobel Economics',
  'Richard Thaler Nobel Economics',
  'Abhijit Banerjee Nobel Economics',
  'Esther Duflo Nobel Economics',
  'Claudia Goldin Nobel Economics',

  'Archimedes', 'Euclid', 'Pythagoras', 'Hippocrates',
  'Al Biruni', 'Ibn al Haytham', 'Al Khwarizmi', 'Avicenna',
  'Roger Bacon', 'Nicolaus Copernicus', 'Tycho Brahe',
  'Johannes Kepler', 'Galileo Galilei', 'Isaac Newton',
  'Robert Hooke', 'Antonie van Leeuwenhoek', 'Christiaan Huygens',
  'Gottfried Wilhelm Leibniz', 'Leonhard Euler',
  'Antoine Lavoisier', 'Carl Linnaeus', 'Joseph Priestley',
  'Henry Cavendish', 'Alessandro Volta', 'William Herschel',
  'John Dalton', 'Humphry Davy', 'Michael Faraday',
  'Charles Babbage', 'Ada Lovelace', 'James Clerk Maxwell',
  'Louis Pasteur', 'Robert Koch', 'Joseph Lister',
  'Charles Darwin', 'Gregor Mendel', 'Thomas Huxley',
  'Ernst Haeckel', 'Francis Galton', 'Ivan Pavlov',
  'Wilhelm Röntgen', 'Henri Becquerel', 'Marie Curie',
  'Pierre Curie', 'Max Planck', 'Albert Einstein',
  'Niels Bohr', 'Ernest Rutherford', 'Paul Dirac',
  'Werner Heisenberg', 'Erwin Schrödinger', 'Enrico Fermi',
  'Robert Oppenheimer', 'Richard Feynman', 'Murray Gell-Mann',
  'Linus Pauling', 'James Watson', 'Francis Crick',
  'Rosalind Franklin', 'Frederick Sanger', 'Jonas Salk',
  'Alexander Fleming', 'Edward Jenner', 'Joseph Lister',
  'Nikola Tesla', 'Thomas Edison', 'Guglielmo Marconi',
  'Werner von Braun', 'Alan Turing', 'John von Neumann',
  'Claude Shannon', 'Norbert Wiener', 'Tim Berners Lee',
  'Stephen Hawking', 'Carl Sagan', 'Neil deGrasse Tyson',
  'Jane Goodall', 'David Attenborough', 'E O Wilson',
  'Lynn Margulis', 'Barbara McClintock', 'Rita Levi Montalcini',
  'Vera Rubin', 'Chien Shiung Wu', 'Lise Meitner',
  'Emmy Noether', 'Hypatia of Alexandria',

  'Thales of Miletus', 'Anaximander', 'Anaximenes',
  'Heraclitus', 'Parmenides', 'Empedocles', 'Anaxagoras',
  'Democritus', 'Leucippus', 'Pythagoras',
  'Protagoras', 'Gorgias', 'Socrates', 'Plato', 'Aristotle',
  'Epicurus', 'Epictetus', 'Marcus Aurelius', 'Seneca',
  'Cicero', 'Plotinus', 'Augustine of Hippo',
  'Thomas Aquinas', 'William of Ockham', 'Duns Scotus',
  'Roger Bacon', 'Francis Bacon', 'Thomas Hobbes',
  'René Descartes', 'Baruch Spinoza', 'Gottfried Leibniz',
  'John Locke', 'George Berkeley', 'David Hume',
  'Immanuel Kant', 'Georg Hegel', 'Arthur Schopenhauer',
  'Søren Kierkegaard', 'Friedrich Nietzsche',
  'Karl Marx', 'Friedrich Engels', 'John Stuart Mill',
  'Jeremy Bentham', 'Auguste Comte', 'Herbert Spencer',
  'William James', 'John Dewey', 'Charles Sanders Peirce',
  'Gottlob Frege', 'Bertrand Russell', 'G E Moore',
  'Ludwig Wittgenstein', 'Martin Heidegger', 'Edmund Husserl',
  'Jean Paul Sartre', 'Simone de Beauvoir', 'Albert Camus',
  'Maurice Merleau Ponty', 'Emmanuel Levinas',
  'Hannah Arendt', 'Walter Benjamin', 'Theodor Adorno',
  'Max Horkheimer', 'Herbert Marcuse', 'Jürgen Habermas',
  'Michel Foucault', 'Jacques Derrida', 'Gilles Deleuze',
  'Jean Baudrillard', 'Julia Kristeva', 'Judith Butler',
  'John Rawls', 'Robert Nozick', 'Peter Singer',
  'Derek Parfit', 'Thomas Nagel', 'Daniel Dennett',
  'Noam Chomsky Philosophy', 'Slavoj Zizek',
  'Confucius', 'Mencius', 'Xunzi', 'Laozi', 'Zhuangzi',
  'Han Feizi', 'Wang Yangming', 'Nagarjuna',
  'Adi Shankaracharya', 'Ramanuja', 'Madhva',
  'Al Farabi', 'Avicenna Philosophy', 'Averroes',
  'Al Ghazali', 'Ibn Khaldun', 'Maimonides',

  // Renaissance
  'Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Donatello',
  'Botticelli', 'Titian', 'Tintoretto', 'Veronese',
  'Giotto', 'Masaccio', 'Fra Angelico', 'Piero della Francesca',
  'Jan van Eyck', 'Rogier van der Weyden', 'Hans Holbein',
  'Albrecht Dürer', 'Matthias Grünewald',
  'El Greco', 'Diego Velazquez', 'Francisco Goya',
  'Peter Paul Rubens', 'Anthony van Dyck', 'Jan Vermeer',
  'Rembrandt van Rijn', 'Frans Hals',

  // 19th century
  'Jacques Louis David', 'Jean Auguste Ingres',
  'Eugene Delacroix', 'Theodore Gericault',
  'Caspar David Friedrich', 'J M W Turner', 'John Constable',
  'Gustave Courbet', 'Jean François Millet', 'Honore Daumier',
  'Édouard Manet', 'Claude Monet', 'Pierre Auguste Renoir',
  'Edgar Degas', 'Alfred Sisley', 'Camille Pissarro',
  'Berthe Morisot', 'Mary Cassatt', 'Paul Cézanne',
  'Paul Gauguin', 'Vincent van Gogh', 'Georges Seurat',
  'Henri de Toulouse Lautrec', 'Auguste Rodin',

  // 20th century
  'Pablo Picasso', 'Georges Braque', 'Henri Matisse',
  'Wassily Kandinsky', 'Paul Klee', 'Franz Marc',
  'Ernst Ludwig Kirchner', 'Egon Schiele', 'Oskar Kokoschka',
  'Marcel Duchamp', 'Max Ernst', 'Salvador Dali',
  'Rene Magritte', 'Joan Miro', 'Giorgio de Chirico',
  'Frida Kahlo', 'Diego Rivera', 'Jose Clemente Orozco',
  'Edward Hopper', 'Grant Wood', 'Georgia O Keeffe',
  'Jackson Pollock', 'Mark Rothko', 'Willem de Kooning',
  'Franz Kline', 'Lee Krasner', 'Helen Frankenthaler',
  'Andy Warhol', 'Roy Lichtenstein', 'Jasper Johns',
  'Robert Rauschenberg', 'Frank Stella', 'Donald Judd',
  'Joseph Beuys', 'Yoko Ono', 'Marina Abramovic',
  'Jean Michel Basquiat', 'Keith Haring', 'Banksy',
  'Damien Hirst', 'Jeff Koons', 'Cindy Sherman',
  'Ai Weiwei', 'Yayoi Kusama',

  'Afghanistan history and culture', 'Albania history and culture',
  'Algeria history and culture', 'Andorra history', 'Angola history',
  'Antigua and Barbuda history', 'Armenia history and culture',
  'Azerbaijan history', 'Bahamas history', 'Bahrain history',
  'Bangladesh history and culture', 'Barbados history',
  'Belarus history', 'Belize history', 'Benin history',
  'Bhutan history and culture', 'Bolivia history',
  'Bosnia and Herzegovina history', 'Botswana history',
  'Brunei history', 'Bulgaria history', 'Burkina Faso history',
  'Burundi history', 'Cabo Verde history', 'Cambodia history',
  'Cameroon history', 'Central African Republic history',
  'Chad history', 'Comoros history', 'Congo history',
  'Costa Rica history', 'Croatia history', 'Cyprus history',
  'Djibouti history', 'Dominica history', 'Dominican Republic history',
  'Ecuador history', 'El Salvador history', 'Equatorial Guinea history',
  'Eritrea history', 'Estonia history', 'Eswatini history',
  'Fiji history', 'Gabon history', 'Gambia history',
  'Georgia country history', 'Grenada history', 'Guatemala history',
  'Guinea history', 'Guinea Bissau history', 'Guyana history',
  'Haiti history and culture', 'Honduras history', 'Iceland history',
  'Jamaica history and culture', 'Jordan history',
  'Kazakhstan history', 'Kiribati history', 'Kuwait history',
  'Kyrgyzstan history', 'Laos history', 'Latvia history',
  'Lebanon history', 'Lesotho history', 'Liberia history',
  'Libya history', 'Liechtenstein history', 'Lithuania history',
  'Luxembourg history', 'Madagascar history', 'Malawi history',
  'Maldives history', 'Mali history', 'Malta history',
  'Marshall Islands history', 'Mauritania history', 'Mauritius history',
  'Micronesia history', 'Moldova history', 'Monaco history',
  'Montenegro history', 'Mozambique history', 'Myanmar history',
  'Namibia history', 'Nauru history', 'Nepal history',
  'Nicaragua history', 'Niger history', 'North Macedonia history',
  'Palau history', 'Palestine history and culture', 'Panama history',
  'Papua New Guinea history', 'Paraguay history', 'Qatar history',
  'Rwanda history', 'Saint Kitts and Nevis history', 'Saint Lucia history',
  'Saint Vincent and the Grenadines history', 'Samoa history',
  'San Marino history', 'Sao Tome and Principe history',
  'Senegal history', 'Seychelles history', 'Sierra Leone history',
  'Slovakia history', 'Slovenia history', 'Solomon Islands history',
  'Somalia history', 'South Sudan history', 'Suriname history',
  'Tajikistan history', 'Timor Leste history', 'Togo history',
  'Tonga history', 'Trinidad and Tobago history', 'Turkmenistan history',
  'Tuvalu history', 'Vanuatu history', 'Vatican City history',
  'Uzbekistan history',

  'London history', 'New York City history', 'Tokyo history',
  'Paris history', 'Shanghai history', 'Beijing history',
  'Dubai history', 'Singapore history', 'Los Angeles history',
  'Chicago history', 'Toronto history', 'Sydney history',
  'Melbourne history', 'Mumbai history', 'Delhi history',
  'Bangalore history', 'Kolkata history', 'Istanbul history',
  'Moscow history', 'Berlin history', 'Madrid history',
  'Rome history', 'Amsterdam history', 'Vienna history',
  'Zurich history', 'Stockholm history', 'Oslo history',
  'Copenhagen history', 'Helsinki history', 'Brussels history',
  'Warsaw history', 'Prague history', 'Budapest history',
  'Athens history', 'Lisbon history', 'Barcelona history',
  'Milan history', 'Seoul history', 'Hong Kong history',
  'Taipei history', 'Bangkok history', 'Jakarta history',
  'Manila history', 'Kuala Lumpur history', 'Ho Chi Minh City history',
  'Dhaka history', 'Karachi history', 'Tehran history',
  'Baghdad history', 'Riyadh history', 'Cairo history',
  'Casablanca history', 'Lagos history', 'Nairobi history',
  'Addis Ababa history', 'Cape Town history', 'Johannesburg history',
  'Buenos Aires history', 'Sao Paulo history', 'Rio de Janeiro history',
  'Lima history', 'Bogota history', 'Santiago Chile history',
  'Mexico City history', 'Havana history', 'Miami history',
  'San Francisco history', 'Washington DC history', 'Boston history',
  'Seattle history', 'Houston history', 'Atlanta history',
  'Las Vegas history', 'Montreal history', 'Vancouver history',
  'Auckland history', 'Brisbane history', 'Perth history',
  'Mecca history', 'Medina history', 'Kathmandu history',
  'Colombo history', 'Yangon history', 'Phnom Penh history',
  'Ulaanbaatar history', 'Tbilisi history', 'Yerevan history',
  'Baku history', 'Tashkent history', 'Almaty history',
  'Minsk history', 'Kyiv history', 'Bucharest history',
  'Sofia history', 'Belgrade history', 'Zagreb history',
  'Sarajevo history', 'Skopje history', 'Tirana history',
  'Valletta history', 'Nicosia history', 'Reykjavik history',
  'Vilnius history', 'Riga history', 'Tallinn history',

  'Battle of Marathon 490 BC', 'Battle of Thermopylae 480 BC',
  'Battle of Salamis 480 BC', 'Battle of Plataea 479 BC',
  'Battle of Gaugamela 331 BC', 'Battle of Hydaspes 326 BC',
  'Battle of Cannae 216 BC', 'Battle of Zama 202 BC',
  'Battle of Actium 31 BC', 'Battle of Teutoburg Forest 9 AD',
  'Battle of Tours 732', 'Battle of Hastings 1066',
  'Battle of Manzikert 1071', 'Battle of Hattin 1187',
  'Battle of Ain Jalut 1260', 'Battle of Agincourt 1415',
  'Battle of Constantinople 1453', 'Battle of Lepanto 1571',
  'Battle of Spanish Armada 1588', 'Battle of Blenheim 1704',
  'Battle of Poltava 1709', 'Battle of Plassey 1757',
  'Battle of Bunker Hill 1775', 'Battle of Saratoga 1777',
  'Battle of Yorktown 1781', 'Battle of Trafalgar 1805',
  'Battle of Austerlitz 1805', 'Battle of Borodino 1812',
  'Battle of Leipzig 1813', 'Battle of Waterloo 1815',
  'Battle of Gettysburg 1863', 'Battle of Antietam 1862',
  'Battle of Bull Run 1861', 'Battle of Tsushima 1905',
  'Battle of the Marne 1914', 'Battle of Verdun 1916',
  'Battle of the Somme 1916', 'Battle of Passchendaele 1917',
  'Battle of Gallipoli 1915', 'Battle of Britain 1940',
  'Battle of Stalingrad 1942 1943', 'Battle of Midway 1942',
  'Battle of El Alamein 1942', 'Battle of Kursk 1943',
  'Battle of Normandy D Day 1944', 'Battle of the Bulge 1944',
  'Battle of Iwo Jima 1945', 'Battle of Okinawa 1945',
  'Battle of Berlin 1945', 'Battle of Inchon 1950',
  'Battle of Dien Bien Phu 1954', 'Battle of Ia Drang 1965',
  'Battle of Hue 1968', 'Battle of Fallujah 2004',
  'Battle of Mosul 2016 2017',

  'Apple Inc founding and history', 'Microsoft founding and history',
  'Google founding and history', 'Amazon founding and history',
  'Meta Facebook founding and history', 'Tesla founding and history',
  'SpaceX founding and history', 'Netflix founding and history',
  'Uber founding and history', 'Airbnb founding and history',
  'Twitter X founding and history', 'TikTok ByteDance history',
  'Alibaba founding and history', 'Tencent history',
  'Baidu history', 'Samsung founding and history',
  'Sony founding and history', 'Toyota founding and history',
  'Volkswagen founding and history', 'BMW founding and history',
  'Mercedes Benz history', 'Ford Motor Company history',
  'General Motors history', 'General Electric history',
  'IBM founding and history', 'Intel founding and history',
  'NVIDIA founding and history', 'AMD history',
  'Qualcomm history', 'TSMC history',
  'JPMorgan Chase history', 'Goldman Sachs history',
  'BlackRock history', 'Berkshire Hathaway history',
  'Visa history', 'Mastercard history', 'PayPal history',
  'Stripe founding and history', 'Coinbase history',
  'Binance history', 'Walmart founding and history',
  'IKEA founding and history', 'McDonalds founding and history',
  'Coca Cola founding and history', 'PepsiCo history',
  'Nestle history', 'Unilever history',
  'Johnson and Johnson history', 'Pfizer history',
  'Moderna founding and history', 'AstraZeneca history',
  'ExxonMobil history', 'Shell history', 'BP history',
  'Saudi Aramco history', 'LVMH history',
  'Nike founding and history', 'Adidas history',
  'Airbus history', 'Boeing history',
  'Lockheed Martin history', 'Raytheon history',
  'Oracle history', 'Salesforce history',
  'Adobe history', 'Cisco history',
  'Zoom history', 'Slack history',
  'Spotify history', 'Dropbox history',
  'Twitter history', 'LinkedIn history',
  'Pinterest history', 'Snapchat history',
  'Robinhood history', 'Revolut history',
  'Klarna history', 'Afterpay history',

  'Malaria disease history', 'Tuberculosis disease history',
  'HIV AIDS history', 'Influenza history', 'COVID 19 pandemic',
  'Smallpox history and eradication', 'Polio history and vaccine',
  'Measles history', 'Cholera history', 'Typhoid fever history',
  'Yellow fever history', 'Dengue fever', 'Zika virus',
  'Ebola virus history', 'Marburg virus', 'SARS history',
  'MERS history', 'Bubonic Plague Black Death', 'Leprosy history',
  'Sleeping sickness', 'Chagas disease', 'Leishmaniasis',
  'Schistosomiasis', 'River blindness', 'Lymphatic filariasis',
  'Cancer history and treatment', 'Lung cancer', 'Breast cancer',
  'Prostate cancer', 'Colon cancer', 'Skin cancer melanoma',
  'Leukemia history', 'Lymphoma', 'Brain tumor',
  'Heart disease history', 'Coronary artery disease',
  'Heart attack myocardial infarction', 'Stroke cerebrovascular',
  'Hypertension high blood pressure', 'Atherosclerosis',
  'Diabetes type 1 history', 'Diabetes type 2 history', 'Obesity',
  'Alzheimers disease history', 'Parkinsons disease history',
  'Multiple sclerosis', 'ALS motor neuron disease',
  'Huntingtons disease', 'Epilepsy history', 'Migraine',
  'Depression history', 'Schizophrenia history',
  'Bipolar disorder', 'Anxiety disorders', 'PTSD history',
  'OCD history', 'Autism spectrum disorder history',
  'ADHD history', 'Rheumatoid arthritis', 'Lupus',
  'Crohns disease', 'Ulcerative colitis', 'Celiac disease',
  'Psoriasis', 'Asthma history', 'COPD',
  'Cystic fibrosis', 'Sickle cell disease', 'Hemophilia',
  'Down syndrome', 'Marfan syndrome',
  'Kidney disease', 'Liver cirrhosis', 'Hepatitis B',
  'Hepatitis C', 'Sepsis', 'Meningitis', 'Pneumonia',
  'Spanish Flu 1918 pandemic', 'Typhus history', 'Dysentery history',
  'Scurvy history', 'Rickets history', 'Pellagra history',

  'Zeus king of the gods', 'Hera queen of gods', 'Poseidon god of sea',
  'Demeter goddess of harvest', 'Athena goddess of wisdom',
  'Apollo god of sun', 'Artemis goddess of hunt',
  'Ares god of war', 'Aphrodite goddess of love',
  'Hephaestus god of fire', 'Hermes messenger god',
  'Dionysus god of wine', 'Hades god of underworld',
  'Persephone queen of underworld', 'Hercules Greek hero',
  'Achilles Trojan War hero', 'Odysseus The Odyssey',
  'Perseus and Medusa', 'Theseus and Minotaur',
  'Jason and the Argonauts', 'Prometheus and fire',
  'Pandoras Box myth', 'Orpheus and Eurydice',
  'Oedipus myth', 'Antigone Greek tragedy',
  'The Iliad summary', 'The Odyssey summary',
  'Odin All Father Norse', 'Thor god of thunder Norse',
  'Loki Norse trickster', 'Freya Norse goddess',
  'Baldur Norse mythology', 'Tyr Norse mythology',
  'Ragnarok end of world Norse', 'Yggdrasil World Tree',
  'Valhalla Norse afterlife', 'The Valkyries Norse',
  'Ra Egyptian sun god', 'Osiris Egyptian god',
  'Isis Egyptian goddess', 'Horus Egyptian falcon god',
  'Anubis god of death Egypt', 'Set Egyptian god of chaos',
  'Thoth Egyptian wisdom god', 'Amun Ra Egyptian god',
  'Brahma Hindu creator god', 'Vishnu Hindu preserver',
  'Shiva Hindu destroyer', 'Lakshmi Hindu goddess',
  'Saraswati goddess of knowledge', 'Durga Hindu warrior goddess',
  'Kali Hindu goddess', 'Ganesha Hindu elephant god',
  'Krishna Hindu god', 'Rama Hindu god',
  'The Ramayana epic', 'The Mahabharata epic',
  'Quetzalcoatl Aztec feathered serpent', 'Huitzilopochtli Aztec sun god',
  'Tlaloc Aztec rain god', 'Inti Inca sun god',
  'Viracocha Inca creator god', 'Mayan Popol Vuh creation myth',
  'Celtic mythology overview', 'Cu Chulainn Celtic hero',
  'Lugh Celtic sun god', 'The Morrigan Celtic goddess',
  'King Arthur legend', 'Merlin wizard legend',
  'Knights of the Round Table', 'Holy Grail legend',
  'Chinese dragon mythology', 'Jade Emperor Chinese mythology',
  'Sun Wukong Monkey King', 'Journey to the West',
  'Amaterasu Japanese sun goddess', 'Susanoo Japanese storm god',
  'Izanagi and Izanami Japanese creation', 'Tengu Japanese mythology',
  'Anansi African spider god', 'Epic of Gilgamesh',
  'Marduk Babylonian chief god', 'Ishtar Mesopotamian goddess',
  'Enkidu Gilgamesh companion', 'Tiamat Babylonian chaos dragon',

  'Classical music history', 'Baroque music period',
  'Classical period music', 'Romantic era music',
  'Impressionist music', 'Modern classical music',
  'Contemporary classical music', 'Opera history',
  'Chamber music history', 'Symphony orchestra history',
  'Choral music history', 'Jazz history overview',
  'Bebop jazz history', 'Cool jazz history',
  'Hard bop jazz', 'Free jazz history',
  'Fusion jazz history', 'Smooth jazz',
  'Delta blues history', 'Chicago blues',
  'Electric blues history', 'Blues influence on music',
  'Rock and roll origins', 'Classic rock era',
  'Hard rock history', 'Heavy metal history',
  'Thrash metal history', 'Death metal history',
  'Black metal history', 'Doom metal history',
  'Power metal history', 'Progressive rock history',
  'Psychedelic rock history', 'Punk rock history',
  'Post punk history', 'New wave music history',
  'Alternative rock history', 'Grunge music history',
  'Indie rock history', 'Britpop history',
  'Pop music history', 'Dance pop history',
  'Synth pop history', 'Electropop history',
  'Hip hop origins', 'East coast hip hop',
  'West coast hip hop', 'Southern hip hop',
  'Trap music history', 'Drill music history',
  'Grime music history', 'UK hip hop history',
  'R&B rhythm and blues history', 'Soul music history',
  'Funk music history', 'Neo soul music',
  'Disco history', 'House music history',
  'Chicago house music', 'Detroit techno',
  'Techno music history', 'Electronic dance music',
  'Trance music history', 'Drum and bass history',
  'Dubstep history', 'Ambient music history',
  'New age music', 'Reggae history',
  'Ska music history', 'Rocksteady music',
  'Dancehall music history', 'Dub music',
  'Country music history', 'Outlaw country',
  'Bluegrass music history', 'Folk music history',
  'American folk revival', 'Americana music',
  'Gospel music history', 'Spiritual music',
  'Contemporary Christian music', 'Latin music history',
  'Salsa music history', 'Reggaeton history',
  'Bossa nova history', 'Samba music history',
  'Tango history', 'Flamenco history',
  'Cumbia music history', 'Merengue music',
  'K pop history and culture', 'J pop history',
  'City pop Japan', 'Bollywood music history',
  'Qawwali music history', 'Afrobeats history',
  'Highlife music Ghana', 'Juju music Nigeria',
  'Afropop history', 'Mbalax music Senegal',
  'Soukous music Congo', 'World music overview',
  'Medieval music history', 'Renaissance music history',
  'Troubadour music', 'Gregorian chant history',

  'The Iliad Homer analysis', 'The Odyssey Homer analysis',
  'The Aeneid Virgil', 'The Divine Comedy Dante',
  'Canterbury Tales Chaucer', 'Don Quixote Cervantes',
  'Hamlet Shakespeare', 'Romeo and Juliet Shakespeare',
  'Macbeth Shakespeare', 'King Lear Shakespeare',
  'Othello Shakespeare', 'A Midsummer Nights Dream',
  'The Merchant of Venice', 'The Tempest Shakespeare',
  'Paradise Lost Milton', 'Gullivers Travels Swift',
  'Robinson Crusoe Defoe', 'Tom Jones Henry Fielding',
  'Candide Voltaire', 'Faust Goethe',
  'Don Juan Byron', 'Frankenstein Shelley',
  'Pride and Prejudice Austen', 'Sense and Sensibility Austen',
  'Emma Austen', 'Northanger Abbey Austen',
  'Persuasion Austen', 'Wuthering Heights Emily Bronte',
  'Jane Eyre Charlotte Bronte', 'Villette Charlotte Bronte',
  'Great Expectations Dickens', 'Oliver Twist Dickens',
  'A Tale of Two Cities Dickens', 'David Copperfield Dickens',
  'Bleak House Dickens', 'Our Mutual Friend Dickens',
  'Middlemarch George Eliot', 'The Mill on the Floss',
  'Tess of the dUrbervilles Hardy', 'Far from the Madding Crowd',
  'Jude the Obscure Hardy', 'War and Peace Tolstoy',
  'Anna Karenina Tolstoy', 'Crime and Punishment Dostoevsky',
  'The Brothers Karamazov Dostoevsky', 'The Idiot Dostoevsky',
  'Demons Dostoevsky', 'Notes from Underground',
  'Dead Souls Gogol', 'The Overcoat Gogol',
  'Fathers and Sons Turgenev', 'The Cherry Orchard Chekhov',
  'The Seagull Chekhov', 'Three Sisters Chekhov',
  'Les Miserables Victor Hugo', 'The Hunchback of Notre Dame',
  'Notre Dame de Paris', 'Madame Bovary Flaubert',
  'The Count of Monte Cristo Dumas', 'The Three Musketeers Dumas',
  'Germinal Zola', 'Nana Zola', 'Therese Raquin Zola',
  'Moby Dick Melville', 'The Scarlet Letter Hawthorne',
  'Huckleberry Finn Twain', 'Tom Sawyer Twain',
  'The Adventures of Huckleberry Finn', 'Billy Budd Melville',
  'The Picture of Dorian Gray Wilde', 'Dracula Stoker',
  'Jekyll and Hyde Stevenson', 'Sherlock Holmes stories',
  'The Hound of the Baskervilles', 'The Time Machine Wells',
  'The War of the Worlds Wells', 'The Invisible Man Wells',
  'Heart of Darkness Conrad', 'Lord Jim Conrad',
  'The Metamorphosis Kafka', 'The Trial Kafka',
  'The Castle Kafka', 'Ulysses Joyce',
  'Dubliners Joyce', 'Portrait of the Artist Joyce',
  'In Search of Lost Time Proust', 'Mrs Dalloway Woolf',
  'To the Lighthouse Woolf', 'The Waves Woolf',
  'The Great Gatsby Fitzgerald', 'Tender is the Night',
  'A Farewell to Arms Hemingway', 'The Sun Also Rises',
  'The Old Man and the Sea Hemingway', 'For Whom the Bell Tolls',
  'Of Mice and Men Steinbeck', 'The Grapes of Wrath Steinbeck',
  'East of Eden Steinbeck', 'Cannery Row Steinbeck',
  '1984 Orwell', 'Animal Farm Orwell',
  'Brave New World Huxley', 'Point Counter Point Huxley',
  'Lord of the Flies Golding', 'The Inheritors Golding',
  'The Catcher in the Rye Salinger', 'Franny and Zooey',
  'To Kill a Mockingbird Lee', 'Go Set a Watchman Lee',
  'Lolita Nabokov', 'Pale Fire Nabokov',
  'One Hundred Years of Solitude Marquez',
  'Love in the Time of Cholera', 'The Alchemist Coelho',
  'Midnight Children Rushdie', 'The Satanic Verses Rushdie',
  'The God of Small Things Roy', 'Beloved Morrison',
  'Song of Solomon Morrison', 'The Color Purple Walker',
  'Things Fall Apart Achebe', 'Arrow of God Achebe',
  'Catch 22 Heller', 'Slaughterhouse Five Vonnegut',
  'The Master and Margarita Bulgakov',
  'Doctor Zhivago Pasternak',
  'The Tin Drum Grass', 'The Magic Mountain Mann',
  'Buddenbrooks Mann', 'Steppenwolf Hesse',
  'Siddhartha Hesse', 'The Trial Kafka',
  'The Lord of the Rings Tolkien', 'The Hobbit Tolkien',
  'The Silmarillion Tolkien',
  'Harry Potter and the Philosophers Stone',
  'Harry Potter Chamber of Secrets',
  'Harry Potter Prisoner of Azkaban',
  'Harry Potter Goblet of Fire',
  'Harry Potter Order of the Phoenix',
  'Harry Potter Half Blood Prince',
  'Harry Potter Deathly Hallows',
  'Dune Frank Herbert', 'Dune Messiah Herbert',
  'Foundation Asimov', 'I Robot Asimov',
  'Neuromancer Gibson', 'Snow Crash Stephenson',
  'The Handmaids Tale Atwood', 'Oryx and Crake Atwood',
  'Fahrenheit 451 Bradbury', 'The Martian Chronicles Bradbury',
  'Hitchhikers Guide to Galaxy Adams',
  'A Song of Ice and Fire Martin',
  'The Da Vinci Code Brown', 'Angels and Demons Brown',
  'In Cold Blood Capote', 'The Bell Jar Plath',
  'Invisible Man Ellison', 'Native Son Wright',
  'The Sun Also Rises', 'Their Eyes Were Watching God Hurston',
  'Beloved Toni Morrison', 'Sula Morrison',
  'Wide Sargasso Sea Rhys', 'Rebecca Du Maurier',
  'Gone with the Wind Mitchell', 'The Help Stockett',
  'Life of Pi Martel', 'The Kite Runner Hosseini',
  'A Thousand Splendid Suns Hosseini',
  'The Shadow of the Wind Ruiz Zafon',
  'The Name of the Rose Eco', 'Foucaults Pendulum Eco',
  'If on a winters night a traveler Calvino',
  'Invisible Cities Calvino',
  'The Stranger Camus', 'The Plague Camus',
  'Nausea Sartre', 'No Exit Sartre',
  'Waiting for Godot Beckett', 'Endgame Beckett',
  'The Birthday Party Pinter', 'Look Back in Anger Osborne',
  'A Raisin in the Sun Hansberry',
  'Death of a Salesman Miller', 'The Crucible Miller',
  'A Streetcar Named Desire Williams',
  'The Glass Menagerie Williams',
  'Long Days Journey into Night ONeill',
  'The Importance of Being Earnest Wilde',
  'An Ideal Husband Wilde',

  'Robert Walpole first Prime Minister UK', 'William Pitt the Younger biography',
  'Duke of Wellington Prime Minister', 'Robert Peel biography',
  'Benjamin Disraeli biography', 'William Ewart Gladstone biography',
  'Lord Palmerston biography', 'Lord Salisbury biography',
  'Arthur Balfour biography', 'Herbert Henry Asquith biography',
  'David Lloyd George biography', 'Andrew Bonar Law biography',
  'Stanley Baldwin biography', 'Ramsay MacDonald biography',
  'Neville Chamberlain biography', 'Winston Churchill biography',
  'Clement Attlee biography', 'Anthony Eden biography',
  'Harold Macmillan biography', 'Alec Douglas Home biography',
  'Harold Wilson biography', 'Edward Heath biography',
  'James Callaghan biography', 'Margaret Thatcher biography',
  'John Major biography', 'Tony Blair biography',
  'Gordon Brown biography', 'David Cameron biography',
  'Theresa May biography', 'Boris Johnson biography',
  'Liz Truss biography shortest serving PM',
  'Rishi Sunak biography', 'Keir Starmer biography',

  'George Washington first President', 'John Adams second President',
  'Thomas Jefferson third President', 'James Madison fourth President',
  'James Monroe fifth President', 'John Quincy Adams sixth President',
  'Andrew Jackson seventh President', 'Martin Van Buren eighth President',
  'William Henry Harrison ninth President', 'John Tyler tenth President',
  'James K Polk eleventh President', 'Zachary Taylor twelfth President',
  'Millard Fillmore thirteenth President', 'Franklin Pierce fourteenth President',
  'James Buchanan fifteenth President', 'Abraham Lincoln sixteenth President',
  'Andrew Johnson seventeenth President', 'Ulysses S Grant eighteenth President',
  'Rutherford B Hayes nineteenth President', 'James Garfield twentieth President',
  'Chester Arthur twenty first President', 'Grover Cleveland twenty second President',
  'Benjamin Harrison twenty third President', 'William McKinley twenty fifth President',
  'Theodore Roosevelt twenty sixth President', 'William Howard Taft twenty seventh President',
  'Woodrow Wilson twenty eighth President', 'Warren Harding twenty ninth President',
  'Calvin Coolidge thirtieth President', 'Herbert Hoover thirty first President',
  'Franklin Roosevelt thirty second President', 'Harry Truman thirty third President',
  'Dwight Eisenhower thirty fourth President', 'John F Kennedy thirty fifth President',
  'Lyndon Johnson thirty sixth President', 'Richard Nixon thirty seventh President',
  'Gerald Ford thirty eighth President', 'Jimmy Carter thirty ninth President',
  'Ronald Reagan fortieth President', 'George H W Bush forty first President',
  'Bill Clinton forty second President', 'George W Bush forty third President',
  'Barack Obama forty fourth President', 'Donald Trump forty fifth President',
  'Joe Biden forty sixth President',

  'Tulip Mania 1637 first financial bubble', 'South Sea Bubble 1720',
  'Mississippi Bubble 1720 France', 'Panic of 1837 USA',
  'Panic of 1873 Long Depression', 'Panic of 1893 USA',
  'Panic of 1907 USA', 'Wall Street Crash 1929',
  'The Great Depression 1929 1939', 'Bretton Woods Conference 1944',
  'Oil Crisis 1973 OPEC', 'Second Oil Crisis 1979',
  'Black Monday 1987 stock crash', 'Savings and Loan Crisis USA',
  'Japanese Asset Bubble 1980s', 'Mexican Peso Crisis 1994',
  'Asian Financial Crisis 1997', 'Russian Financial Crisis 1998',
  'Long Term Capital Management collapse', 'Dot Com Bubble 1995 2000',
  'Enron Scandal 2001', 'WorldCom Scandal', 'Sarbanes Oxley Act',
  'Global Financial Crisis 2008', 'Lehman Brothers collapse 2008',
  'Too Big to Fail banks 2008', 'TARP bailout 2008',
  'European Sovereign Debt Crisis 2010', 'Greek Debt Crisis 2010 2018',
  'Flash Crash May 2010', 'Swiss Franc Shock 2015',
  'Chinese Stock Market Crash 2015', 'Brexit economic impact',
  'COVID 19 economic impact', 'GameStop Short Squeeze 2021',
  'Crypto Bull Run 2021', 'Terra Luna Collapse 2022',
  'FTX Collapse Sam Bankman Fried 2022',
  'Silicon Valley Bank Collapse 2023',
  'Credit Suisse collapse 2023',

  'Apollo 11 first Moon landing 1969', 'Apollo 13 mission failure 1970',
  'Apollo 12 Moon landing', 'Apollo 14 Moon landing',
  'Apollo 15 Moon landing', 'Apollo 16 Moon landing',
  'Apollo 17 last Moon landing', 'Sputnik 1 launch 1957',
  'Sputnik 2 Laika dog space', 'Yuri Gagarin first human space 1961',
  'Alan Shepard first American space', 'John Glenn first American orbit',
  'Valentina Tereshkova first woman space', 'Alexei Leonov first spacewalk',
  'Gemini Program NASA', 'Mercury Program NASA',
  'Space Shuttle Program history', 'Challenger disaster 1986',
  'Columbia disaster 2003', 'Mir Space Station',
  'International Space Station construction', 'Hubble Space Telescope launch',
  'Hubble Space Telescope repair missions', 'Mars Pathfinder mission',
  'Mars Rover Spirit and Opportunity', 'Mars Rover Curiosity',
  'Mars Rover Perseverance', 'Mars Ingenuity helicopter',
  'Voyager 1 launch and journey', 'Voyager 2 launch and journey',
  'Pioneer 10 and 11 missions', 'Cassini Saturn mission',
  'Huygens Titan probe', 'New Horizons Pluto flyby',
  'Juno Jupiter mission', 'Dawn asteroid mission',
  'Rosetta comet mission', 'Parker Solar Probe',
  'James Webb Space Telescope launch', 'JWST first images',
  'Artemis 1 Moon mission', 'Artemis program future',
  'SpaceX Falcon 9 reusable rocket', 'SpaceX Dragon capsule',
  'SpaceX Starship development', 'SpaceX Crew Dragon missions',
  'Blue Origin New Shepard flights', 'Virgin Galactic flights',
  'China Tiangong space station', 'China Chang e Moon missions',
  'India Chandrayaan missions', 'India Mangalyaan Mars mission',
  'ISRO history Indian space program', 'ESA Ariane rocket program',
  'JAXA Japanese space agency missions',

  'Great Pyramid of Giza history', 'Hanging Gardens of Babylon',
  'Statue of Zeus at Olympia', 'Temple of Artemis Ephesus',
  'Mausoleum at Halicarnassus', 'Colossus of Rhodes',
  'Lighthouse of Alexandria', 'Colosseum Rome history',
  'Pantheon Rome history', 'Parthenon Athens history',
  'Acropolis Athens history', 'Stonehenge history and mystery',
  'Machu Picchu history', 'Great Wall of China history',
  'Taj Mahal history', 'Alhambra Granada history',
  'Angkor Wat history', 'Chichen Itza history',
  'Terracotta Army China history', 'Petra Jordan history',
  'Hagia Sophia history', 'Notre Dame Cathedral history',
  'Sagrada Familia history', 'Eiffel Tower history',
  'Statue of Liberty history', 'Sydney Opera House history',
  'Burj Khalifa history', 'Panama Canal history',
  'Suez Canal history', 'Palace of Versailles history',
  'The Louvre museum history', 'Vatican Museums history',
  'British Museum history', 'Smithsonian Institution history',
  'Colosseum gladiators history', 'Roman Forum history',
  'Pompeii history', 'Herculaneum history',
  'Persepolis history', 'Babylon ancient city',
  'Teotihuacan history', 'Easter Island history',
  'Nazca Lines mystery', 'Göbekli Tepe oldest temple',
  'Mohenjo Daro history', 'Harappa history',
  'Great Zimbabwe history',

  'Theory of Evolution explained', 'Natural Selection explained',
  'Genetics and DNA explained', 'Cell Theory history',
  'Germ Theory of Disease history', 'Theory of Relativity explained',
  'Quantum Mechanics explained simply', 'The Big Bang Theory explained',
  'Plate Tectonics theory history', 'Periodic Table history',
  'Atomic Theory history', 'Heliocentric Theory history',
  'Laws of Thermodynamics', 'Newtons Laws of Motion',
  'Maxwells Equations', 'Einsteins E equals mc squared',
  'Schrodingers Cat thought experiment', 'Uncertainty Principle Heisenberg',
  'Double Slit Experiment', 'Photoelectric Effect',
  'Special Relativity explained', 'General Relativity explained',
  'Black Hole theory', 'Hawking Radiation',
  'String Theory explained', 'Dark Matter explained',
  'Dark Energy explained', 'The Multiverse theory',
  'Cosmic Inflation theory', 'The Standard Model of particle physics',
  'Higgs Boson discovery', 'Gravitational Waves discovery',
  'CRISPR gene editing explained', 'Stem Cells explained',
  'Epigenetics explained', 'The Human Genome Project',
  'Antibiotic Resistance explained', 'Herd Immunity explained',
  'mRNA Vaccine technology', 'Artificial Intelligence explained',
  'Machine Learning explained', 'Neural Networks explained',
  'Blockchain Technology explained', 'Quantum Computing explained',
  'Nuclear Fusion energy', 'Nuclear Fission explained',
  'Renewable Energy overview', 'Climate Change science explained',
  'The Ozone Layer explained', 'Greenhouse Effect explained',
  'Carbon Cycle explained', 'Nitrogen Cycle explained',
  'Water Cycle explained', 'Food Chain and Food Web',
  'Ecosystem Services', 'Biodiversity importance',
  'Mass Extinction events history', 'Cambrian Explosion',
  'Dinosaur extinction theory', 'Human Evolution timeline',
]

// ── Category seed list ────────────────────────────────────────────
// Each entry asks the AI to generate a list of topics for that category.
// One small AI call → hundreds of topic names → articles seeded for free.
// Cost per entry: ~$0.0001 (tiny list-generation call).
// Add as many categories as you want — duplicates with TOPICS are skipped automatically.



const CATEGORY_SEEDS = [

  // ══════════════════════════════════════════════════════════════
  // FULL DICTIONARY AND VOCABULARY
  // ══════════════════════════════════════════════════════════════
  { category: 'Dictionary A',           prompt: 'List 300 important English words starting with A with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary B',           prompt: 'List 300 important English words starting with B with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary C',           prompt: 'List 300 important English words starting with C with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary D',           prompt: 'List 300 important English words starting with D with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary E',           prompt: 'List 300 important English words starting with E with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary F',           prompt: 'List 300 important English words starting with F with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary G',           prompt: 'List 300 important English words starting with G with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary H',           prompt: 'List 300 important English words starting with H with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary I',           prompt: 'List 300 important English words starting with I with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary J',           prompt: 'List 200 important English words starting with J with definitions, etymology, and usage examples', count: 200 },
  { category: 'Dictionary K',           prompt: 'List 150 important English words starting with K with definitions, etymology, and usage examples', count: 150 },
  { category: 'Dictionary L',           prompt: 'List 300 important English words starting with L with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary M',           prompt: 'List 300 important English words starting with M with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary N',           prompt: 'List 250 important English words starting with N with definitions, etymology, and usage examples', count: 250 },
  { category: 'Dictionary O',           prompt: 'List 250 important English words starting with O with definitions, etymology, and usage examples', count: 250 },
  { category: 'Dictionary P',           prompt: 'List 300 important English words starting with P with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary Q',           prompt: 'List 100 important English words starting with Q with definitions, etymology, and usage examples', count: 100 },
  { category: 'Dictionary R',           prompt: 'List 300 important English words starting with R with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary S',           prompt: 'List 300 important English words starting with S with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary T',           prompt: 'List 300 important English words starting with T with definitions, etymology, and usage examples', count: 300 },
  { category: 'Dictionary U',           prompt: 'List 200 important English words starting with U with definitions, etymology, and usage examples', count: 200 },
  { category: 'Dictionary V',           prompt: 'List 200 important English words starting with V with definitions, etymology, and usage examples', count: 200 },
  { category: 'Dictionary W',           prompt: 'List 250 important English words starting with W with definitions, etymology, and usage examples', count: 250 },
  { category: 'Dictionary X Y Z',       prompt: 'List 150 important English words starting with X, Y, or Z with definitions, etymology, and usage examples', count: 150 },
  { category: 'Dictionary Medical Terms',prompt: 'List 300 important medical and anatomical terms with definitions and etymology', count: 300 },
  { category: 'Dictionary Legal Terms', prompt: 'List 300 important legal terms, Latin legal phrases, and court terminology with definitions', count: 300 },
  { category: 'Dictionary Scientific',  prompt: 'List 300 important scientific terms across all disciplines with definitions', count: 300 },
  { category: 'Dictionary Tech Terms',  prompt: 'List 300 important technology and computing terms with definitions', count: 300 },
  { category: 'Dictionary Finance Terms',prompt: 'List 300 important finance, economics, and banking terms with definitions', count: 300 },
  { category: 'Dictionary Psychology',  prompt: 'List 200 important psychology and psychiatry terms with definitions', count: 200 },
  { category: 'Dictionary Philosophy',  prompt: 'List 200 important philosophical terms and concepts with definitions', count: 200 },
  { category: 'Dictionary Political',   prompt: 'List 200 important political science terms and concepts with definitions', count: 200 },
  { category: 'Dictionary Literary',    prompt: 'List 200 important literary terms, narrative devices, and genre concepts with definitions', count: 200 },
  { category: 'Dictionary Art Terms',   prompt: 'List 200 important art, music, and architecture terms with definitions', count: 200 },
  { category: 'Dictionary Sports Terms',prompt: 'List 200 sports terminology across all major sports with definitions', count: 200 },
  { category: 'Dictionary Culinary',    prompt: 'List 200 culinary, cooking, and food science terms with definitions', count: 200 },
  { category: 'Dictionary Religious',   prompt: 'List 200 religious, theological, and spiritual terms from all religions with definitions', count: 200 },
  { category: 'Dictionary Archaic',     prompt: 'List 200 archaic, obsolete, and old English words with their historical meanings', count: 200 },
  { category: 'Dictionary Borrowed Words', prompt: 'List 200 English words borrowed from other languages like French, German, Arabic, Japanese, Hindi, Spanish', count: 200 },

  // ══════════════════════════════════════════════════════════════
  // COMPLETE GRAMMAR — EVERY RULE AND CONCEPT
  // ══════════════════════════════════════════════════════════════
  { category: 'Parts of Speech',        prompt: 'List and explain all 8 parts of speech in English with 20 subtopics each including nouns, verbs, adjectives, adverbs, pronouns, prepositions, conjunctions, interjections — all types, rules, and exceptions', count: 160 },
  { category: 'Nouns in Depth',         prompt: 'List 100 grammar concepts specifically about nouns including common, proper, abstract, concrete, countable, uncountable, collective, compound, plural rules, possessive, gerunds', count: 100 },
  { category: 'Verbs in Depth',         prompt: 'List 100 grammar concepts specifically about verbs including action, linking, auxiliary, modal, transitive, intransitive, irregular, phrasal, infinitive, participles, gerunds, conjugation', count: 100 },
  { category: 'Tenses Complete',        prompt: 'List all 12 English tenses with their structures, uses, and 10 example rules each — present simple, present continuous, present perfect, present perfect continuous, past simple, past continuous, past perfect, past perfect continuous, future simple, future continuous, future perfect, future perfect continuous', count: 120 },
  { category: 'Sentence Structure',     prompt: 'List 100 grammar concepts about sentence structure including subject, predicate, object, complement, phrases, clauses, simple sentences, compound sentences, complex sentences, compound complex, sentence types', count: 100 },
  { category: 'Punctuation Complete',   prompt: 'List every punctuation mark with 10 usage rules each including period, comma, semicolon, colon, dash, hyphen, apostrophe, quotation marks, parentheses, brackets, ellipsis, slash, exclamation mark, question mark', count: 140 },
  { category: 'Clauses and Phrases',    prompt: 'List 100 grammar concepts about clauses and phrases including independent clauses, dependent clauses, relative clauses, noun clauses, adverbial clauses, participial phrases, gerund phrases, infinitive phrases, prepositional phrases, appositive phrases', count: 100 },
  { category: 'Common Grammar Errors',  prompt: 'List 150 most common English grammar mistakes, errors, and misconceptions with correct usage including run on sentences, comma splices, dangling modifiers, subject verb agreement, pronoun agreement, double negatives', count: 150 },
  { category: 'Grammar Rules Advanced', prompt: 'List 100 advanced English grammar rules including subjunctive mood, conditional sentences, passive voice, reported speech, inversion, ellipsis, substitution, cleft sentences', count: 100 },
  { category: 'Articles Usage',         prompt: 'List 80 rules and concepts about using articles a, an, the in English including zero article, definite article, indefinite article, articles with proper nouns, abstract nouns, geographical names', count: 80 },
  { category: 'Prepositions',           prompt: 'List 100 preposition rules and common preposition combinations including prepositions of time, place, direction, manner, and fixed preposition phrases', count: 100 },
  { category: 'Conjunctions',           prompt: 'List 80 conjunction rules and types including coordinating, subordinating, correlative conjunctions and how to use them correctly', count: 80 },
  { category: 'Conditionals',           prompt: 'List all conditional sentence types in English — zero, first, second, third, mixed conditionals — with 20 rules and examples each', count: 100 },
  { category: 'Passive Voice',          prompt: 'List 80 rules and uses of passive voice in English across all tenses with examples and when to use active vs passive', count: 80 },
  { category: 'Reported Speech',        prompt: 'List 80 rules of reported speech and indirect speech in English including backshifting, reporting verbs, questions in reported speech, commands', count: 80 },
  { category: 'Modals',                 prompt: 'List all modal verbs in English — can, could, may, might, will, would, shall, should, must, ought to, need, dare, used to — with all their uses, rules, and meanings', count: 100 },
  { category: 'Word Formation',         prompt: 'List 100 word formation rules in English including prefixes, suffixes, compounding, conversion, abbreviation, blending, clipping, back formation', count: 100 },
  { category: 'Spelling Rules Complete',prompt: 'List 100 English spelling rules including ie vs ei, doubling consonants, dropping silent e, changing y to i, adding suffixes and prefixes, American vs British spelling', count: 100 },
  { category: 'Capitalization Rules',   prompt: 'List 80 capitalization rules in English including proper nouns, titles, first words, acronyms, days and months, geographic names, institutions', count: 80 },
  { category: 'Question Formation',     prompt: 'List 80 rules for forming questions in English including yes no questions, wh questions, tag questions, indirect questions, subject questions', count: 80 },
  { category: 'Negation Rules',         prompt: 'List 60 rules for forming negative sentences in English across all tenses and verb types', count: 60 },
  { category: 'Comparatives Superlatives', prompt: 'List 80 rules for comparatives and superlatives in English including one syllable, two syllable, three syllable adjectives, irregular forms, double comparatives', count: 80 },

  // ══════════════════════════════════════════════════════════════
  // ABUSIVE AND OFFENSIVE LANGUAGE — MEANINGS AND ORIGINS
  // (Educational context — understanding language history)
  // ══════════════════════════════════════════════════════════════
  { category: 'Profanity Etymology',    prompt: 'List 100 profane and offensive words in English with their historical etymology, origins, and how their meanings evolved over time — educational linguistic analysis only', count: 100 },
  { category: 'Slurs Historical',       prompt: 'List 80 historical slurs and offensive terms used throughout history with their origins, etymology, and why they are harmful — educational context for understanding discrimination', count: 80 },
  { category: 'Offensive Language Types', prompt: 'List 60 categories and types of offensive, abusive, and harmful language including hate speech, slurs, profanity, blasphemy, obscenity — linguistic and sociological analysis', count: 60 },
  { category: 'Swear Words History',    prompt: 'List 80 historically significant swear words and expletives across cultures with their origins, etymology, and changing social meanings over time', count: 80 },
  { category: 'Euphemisms',             prompt: 'List 150 euphemisms in English — polite or indirect words used instead of offensive, harsh, or taboo words — with what they replace and their origins', count: 150 },
  { category: 'Taboo Language',         prompt: 'List 80 taboo language concepts including cultural taboos, linguistic taboos, replacement words, and how taboo language functions across different cultures', count: 80 },
  { category: 'Insults Historical',     prompt: 'List 100 famous historical insults, put-downs, and derogatory terms used throughout history in literature, politics, and culture with their meanings', count: 100 },
  { category: 'Hate Speech Concepts',   prompt: 'List 60 concepts related to hate speech including definitions, legal frameworks, free speech debates, online hate speech, and sociological impact', count: 60 },
  { category: 'Derogatory Terms',       prompt: 'List 80 derogatory terms for various groups throughout history with their origins, impact, and reclamation movements', count: 80 },
  { category: 'Curse Words World',      prompt: 'List 100 notable curse words and swear expressions from languages around the world including French, Spanish, German, Italian, Arabic, Japanese with English translations and cultural context', count: 100 },

  // ══════════════════════════════════════════════════════════════
  // ALL WORLD LANGUAGES
  // ══════════════════════════════════════════════════════════════
  { category: 'Languages of the World', prompt: 'List all 200 most spoken languages in the world with number of speakers, language family, and countries where spoken', count: 200 },
  { category: 'Language Families',      prompt: 'List 80 language families and their branches including Indo European, Sino Tibetan, Afro Asiatic, Austronesian, Niger Congo, Dravidian, Turkic, and all others', count: 80 },
  { category: 'English Language',       prompt: 'List 100 key facts, history, evolution, dialects, and characteristics of the English language from Old English to Modern English', count: 100 },
  { category: 'Spanish Language',       prompt: 'List 100 aspects of the Spanish language including history, grammar highlights, dialects across 20 countries, vocabulary, and cultural influence', count: 100 },
  { category: 'French Language',        prompt: 'List 100 aspects of the French language including history, grammar, dialects, influence on English, and spread across the world', count: 100 },
  { category: 'Mandarin Chinese',       prompt: 'List 100 aspects of Mandarin Chinese including tones, characters, history, dialects, grammar, and difference from Cantonese', count: 100 },
  { category: 'Arabic Language',        prompt: 'List 100 aspects of Arabic including Modern Standard Arabic, dialects, script, grammar, and influence on world languages', count: 100 },
  { category: 'Hindi Language',         prompt: 'List 80 aspects of Hindi including Devanagari script, grammar, vocabulary, relationship to Sanskrit and Urdu', count: 80 },
  { category: 'Portuguese Language',    prompt: 'List 80 aspects of Portuguese including European vs Brazilian Portuguese, history, grammar, and global spread', count: 80 },
  { category: 'Russian Language',       prompt: 'List 80 aspects of Russian including Cyrillic alphabet, grammar cases, history, and Slavic language family', count: 80 },
  { category: 'German Language',        prompt: 'List 80 aspects of German including grammar cases, compound words, history, dialects, and Germanic language family', count: 80 },
  { category: 'Japanese Language',      prompt: 'List 80 aspects of Japanese including hiragana, katakana, kanji, grammar, honorifics, and cultural context', count: 80 },
  { category: 'Korean Language',        prompt: 'List 60 aspects of Korean including Hangul writing system, grammar, honorifics, and history', count: 60 },
  { category: 'Italian Language',       prompt: 'List 60 aspects of Italian including history, regional dialects, grammar, and influence on music and cuisine vocabulary', count: 60 },
  { category: 'Dutch Language',         prompt: 'List 50 aspects of Dutch including history, grammar, Flemish vs Dutch, and words borrowed into English', count: 50 },
  { category: 'Polish Language',        prompt: 'List 50 aspects of Polish including grammar cases, Slavic language family, and history', count: 50 },
  { category: 'Turkish Language',       prompt: 'List 50 aspects of Turkish including agglutinative grammar, script change, and Turkic language family', count: 50 },
  { category: 'Swahili Language',       prompt: 'List 50 aspects of Swahili including Bantu origins, grammar, vocabulary, and role as African lingua franca', count: 50 },
  { category: 'Latin Language',         prompt: 'List 100 aspects of Latin including grammar, cases, influence on English and Romance languages, ecclesiastical Latin, and Latin phrases still used today', count: 100 },
  { category: 'Ancient Greek Language', prompt: 'List 80 aspects of Ancient Greek including dialects, alphabet, grammar, influence on English vocabulary, and scientific terminology', count: 80 },
  { category: 'Sanskrit Language',      prompt: 'List 60 aspects of Sanskrit including grammar, Devanagari script, Vedic Sanskrit, influence on Indian languages and English', count: 60 },
  { category: 'Hebrew Language',        prompt: 'List 60 aspects of Hebrew including Biblical Hebrew, Modern Hebrew revival, alphabet, grammar, and influence on English', count: 60 },
  { category: 'Persian Language',       prompt: 'List 50 aspects of Persian Farsi including history, script, influence on Urdu and other languages, and literature', count: 50 },
  { category: 'Bengali Language',       prompt: 'List 50 aspects of Bengali including script, grammar, literature, and status as major world language', count: 50 },
  { category: 'Urdu Language',          prompt: 'List 50 aspects of Urdu including Nastaliq script, relationship to Hindi, Persian influence, and literary tradition', count: 50 },
  { category: 'Indonesian Language',    prompt: 'List 50 aspects of Indonesian Bahasa Indonesia including grammar, vocabulary, and role as national language', count: 50 },
  { category: 'Vietnamese Language',    prompt: 'List 50 aspects of Vietnamese including tones, Latin script, grammar, and linguistic history', count: 50 },
  { category: 'Thai Language',          prompt: 'List 50 aspects of Thai including tones, script, grammar, and linguistic classification', count: 50 },
  { category: 'Endangered Languages',   prompt: 'List 100 endangered and dying languages around the world with their regions, current speaker counts, and preservation efforts', count: 100 },
  { category: 'Dead Languages',         prompt: 'List 80 extinct and dead languages throughout history including what civilization spoke them and why they died out', count: 80 },
  { category: 'Sign Languages',         prompt: 'List 60 sign languages of the world including ASL, BSL, and how they differ from country to country', count: 60 },
  { category: 'Writing Systems',        prompt: 'List 80 writing systems and scripts used throughout history and today including alphabets, syllabaries, logographic scripts, and undeciphered scripts', count: 80 },
  { category: 'Dialects',               prompt: 'List 100 major dialects of major world languages including English dialects, Spanish dialects, Arabic dialects, Chinese dialects', count: 100 },
  { category: 'Creole Languages',       prompt: 'List 60 creole and pidgin languages around the world with their origins and history', count: 60 },
  { category: 'Constructed Languages',  prompt: 'List 50 constructed and artificial languages including Esperanto, Klingon, Elvish, Dothraki, and others with their creators and purposes', count: 50 },
  { category: 'Bilingualism',           prompt: 'List 60 concepts about bilingualism, multilingualism, language acquisition, and language learning science', count: 60 },
  { category: 'Translation Concepts',   prompt: 'List 60 concepts about translation, interpretation, localization, and the challenges of translating between languages', count: 60 },
  { category: 'Linguistics Concepts',   prompt: 'List 100 core linguistics concepts including phonology, morphology, syntax, semantics, pragmatics, sociolinguistics, psycholinguistics', count: 100 },
  { category: 'Phonetics',              prompt: 'List 80 phonetics concepts including IPA symbols, consonants, vowels, diphthongs, tone, stress, intonation, and place of articulation', count: 80 },
  { category: 'Language Evolution',     prompt: 'List 60 concepts about how languages evolve, change, borrow words, split into dialects, and die', count: 60 },
  { category: 'Code Switching',         prompt: 'List 50 concepts about code switching, language mixing, Spanglish, Hinglish, and how multilingual speakers mix languages', count: 50 },

  // ══════════════════════════════════════════════════════════════
  // ENCYCLOPEDIA COVERAGE — EVERY MAJOR FIELD
  // ══════════════════════════════════════════════════════════════
  { category: 'Encyclopedia Science',   prompt: 'List 300 encyclopedia worthy science topics not yet covered including lesser known phenomena, scientific controversies, emerging fields, and foundational concepts', count: 300 },
  { category: 'Encyclopedia History',   prompt: 'List 300 encyclopedia worthy history topics not yet covered including minor but significant events, forgotten empires, overlooked historical figures, and regional history', count: 300 },
  { category: 'Encyclopedia Geography', prompt: 'List 300 encyclopedia worthy geography topics including specific regions, territories, geographical features, borders, and disputed territories', count: 300 },
  { category: 'Encyclopedia Culture',   prompt: 'List 300 encyclopedia worthy culture topics including traditions, customs, festivals, cultural practices, and cultural movements from around the world', count: 300 },
  { category: 'Encyclopedia Technology',prompt: 'List 300 encyclopedia worthy technology topics not yet covered including specific technologies, standards, protocols, and technical concepts', count: 300 },
  { category: 'Encyclopedia Medicine',  prompt: 'List 300 encyclopedia worthy medical topics not yet covered including rare diseases, medical history, anatomy, physiology, and treatment methods', count: 300 },
  { category: 'Encyclopedia Law',       prompt: 'List 300 encyclopedia worthy law topics including specific laws, court cases, legal principles, international law, and comparative law', count: 300 },
  { category: 'Encyclopedia Economics', prompt: 'List 300 encyclopedia worthy economics topics not yet covered including economic history, institutions, policies, and economic geography', count: 300 },
  { category: 'Encyclopedia Religion',  prompt: 'List 300 encyclopedia worthy religion topics including specific sects, denominations, religious practices, theological debates, and religious history', count: 300 },
  { category: 'Encyclopedia Art',       prompt: 'List 300 encyclopedia worthy art topics including specific art movements, individual artworks, art techniques, art history periods, and art institutions', count: 300 },

  // ══════════════════════════════════════════════════════════════
  // SPECIFIC ENCYCLOPEDIA ARTICLES
  // ══════════════════════════════════════════════════════════════
  { category: 'Chemical Compounds',     prompt: 'List 200 important chemical compounds, molecules, and substances with their properties and uses', count: 200 },
  { category: 'Mathematical Theorems',  prompt: 'List 150 most important mathematical theorems, proofs, and conjectures in history', count: 150 },
  { category: 'Physical Laws',          prompt: 'List 100 fundamental laws and principles of physics with their discoverers and implications', count: 100 },
  { category: 'Logical Concepts',       prompt: 'List 100 concepts in logic including deductive reasoning, inductive reasoning, fallacies, paradoxes, and logical operators', count: 100 },
  { category: 'Economic Indicators',    prompt: 'List 100 economic indicators and metrics used to measure economic performance including GDP, inflation, unemployment, trade balance', count: 100 },
  { category: 'Political Systems',      prompt: 'List 80 types of political systems and government structures from democracy to authoritarianism with examples', count: 80 },
  { category: 'Psychological Disorders',prompt: 'List 150 psychological and psychiatric disorders with symptoms, causes, and treatments', count: 150 },
  { category: 'Architectural Styles',   prompt: 'List 100 architectural styles from ancient to contemporary with their defining characteristics', count: 100 },
  { category: 'Art Movements',          prompt: 'List 100 art movements and styles throughout history with their context and key artists', count: 100 },
  { category: 'Literary Movements',     prompt: 'List 80 literary movements and genres from Ancient Greece to contemporary fiction', count: 80 },
  { category: 'Musical Instruments',    prompt: 'List 150 musical instruments from all cultures worldwide including history and how they work', count: 150 },
  { category: 'Dance Forms',            prompt: 'List 100 dance forms and styles from around the world including folk dances, classical dances, and contemporary styles', count: 100 },
  { category: 'Theatrical Forms',       prompt: 'List 80 theatrical forms and performance styles from Greek tragedy to contemporary experimental theater', count: 80 },
  { category: 'Film Techniques',        prompt: 'List 100 filmmaking techniques, cinematography concepts, and film theory terms', count: 100 },
  { category: 'Photography Techniques',prompt: 'List 80 photography techniques, concepts, and styles', count: 80 },
  { category: 'Printing and Publishing',prompt: 'List 60 concepts in printing, publishing, typography, and book production history', count: 60 },
  { category: 'Libraries and Archives', prompt: 'List 60 famous libraries, archives, and information institutions throughout history', count: 60 },
  { category: 'Museums',                prompt: 'List 100 most famous museums and galleries in the world with their collections', count: 100 },

  // ══════════════════════════════════════════════════════════════
  // IDIOMS AND EXPRESSIONS BY LANGUAGE
  // ══════════════════════════════════════════════════════════════
  { category: 'English Idioms',         prompt: 'List 200 common English idioms with meanings, origins, and example sentences', count: 200 },
  { category: 'Spanish Idioms',         prompt: 'List 150 common Spanish idioms and expressions with English translations and meanings', count: 150 },
  { category: 'French Idioms',          prompt: 'List 150 common French idioms and expressions with English translations and cultural context', count: 150 },
  { category: 'German Idioms',          prompt: 'List 100 common German idioms and expressions with English translations', count: 100 },
  { category: 'Italian Idioms',         prompt: 'List 100 common Italian idioms and expressions with English translations', count: 100 },
  { category: 'Arabic Idioms',          prompt: 'List 100 common Arabic idioms and expressions with English translations and cultural context', count: 100 },
  { category: 'Chinese Idioms',         prompt: 'List 100 famous Chinese four character idioms chengyu with meanings and stories behind them', count: 100 },
  { category: 'Japanese Idioms',        prompt: 'List 100 common Japanese idioms, expressions, and proverbs with English translations', count: 100 },
  { category: 'Latin Phrases',          prompt: 'List 150 famous Latin phrases and their English meanings still used in law, medicine, science, and everyday life', count: 150 },
  { category: 'French Phrases English', prompt: 'List 100 French phrases commonly used in English including en masse, coup de grace, deja vu, and others', count: 100 },
  { category: 'English Proverbs',       prompt: 'List 200 English proverbs with their meanings and origins', count: 200 },
  { category: 'World Proverbs',         prompt: 'List 200 famous proverbs from non English languages around the world with translations and cultural context', count: 200 },

  // ══════════════════════════════════════════════════════════════
  // ABBREVIATIONS, ACRONYMS, AND SHORT FORMS
  // ══════════════════════════════════════════════════════════════
  { category: 'Acronyms Common',        prompt: 'List 200 most common acronyms used in everyday life, business, technology, and media with their full forms', count: 200 },
  { category: 'Medical Abbreviations',  prompt: 'List 150 medical abbreviations and acronyms used in hospitals, prescriptions, and medical records', count: 150 },
  { category: 'Internet Abbreviations', prompt: 'List 150 internet slang abbreviations, text speak, and online shorthand like LOL, ASAP, TBH, FOMO with meanings and origins', count: 150 },
  { category: 'Military Abbreviations', prompt: 'List 100 military abbreviations and acronyms from NATO, US military, and international armed forces', count: 100 },
  { category: 'Scientific Abbreviations',prompt:'List 100 scientific abbreviations, units, and symbols used in physics, chemistry, biology, and mathematics', count: 100 },
  { category: 'Business Abbreviations', prompt: 'List 100 business, finance, and corporate abbreviations and acronyms', count: 100 },
  { category: 'Country Codes',          prompt: 'List all country codes including ISO codes, phone codes, internet domain codes, and currency codes for all 195 countries', count: 195 },

  // ══════════════════════════════════════════════════════════════
  // QUOTES AND SAYINGS
  // ══════════════════════════════════════════════════════════════
  { category: 'Famous Quotes History',  prompt: 'List 200 most famous historical quotes from world leaders, philosophers, and historical figures with context', count: 200 },
  { category: 'Famous Quotes Literature',prompt:'List 150 most famous literary quotes from novels, poetry, and plays with their sources', count: 150 },
  { category: 'Famous Quotes Science',  prompt: 'List 100 most famous quotes from scientists about science, discovery, and the universe', count: 100 },
  { category: 'Famous Quotes Philosophy',prompt:'List 100 most famous philosophical quotes from ancient to modern philosophers', count: 100 },
  { category: 'Famous Quotes Motivational',prompt:'List 150 most famous motivational and inspirational quotes with their sources', count: 150 },
  { category: 'Famous Last Words',      prompt: 'List 80 famous last words of historical figures and their context', count: 80 },
  { category: 'Famous Speeches',        prompt: 'List 100 most famous speeches in history with their context and key lines', count: 100 },

  // ══════════════════════════════════════════════════════════════
  // MOST SEARCHED HISTORICAL YEARS
  // ══════════════════════════════════════════════════════════════
  { category: 'Most Searched 2000',     prompt: 'List 80 most searched topics in 2000 including Y2K aftermath, dot com boom, Sydney Olympics, US election controversy', count: 80 },
  { category: 'Most Searched 2001',     prompt: 'List 80 most searched topics in 2001 including September 11 attacks, anthrax letters, iPod launch, Harry Potter film', count: 80 },
  { category: 'Most Searched 2002',     prompt: 'List 80 most searched topics in 2002 including Bali bombing, World Cup Korea Japan, Euro currency launch', count: 80 },
  { category: 'Most Searched 2003',     prompt: 'List 80 most searched topics in 2003 including Iraq invasion, SARS outbreak, Space Shuttle Columbia, Concorde retirement', count: 80 },
  { category: 'Most Searched 2004',     prompt: 'List 80 most searched topics in 2004 including Facebook launch, Indian Ocean tsunami, Athens Olympics, Abu Ghraib', count: 80 },
  { category: 'Most Searched 2005',     prompt: 'List 80 most searched topics in 2005 including Hurricane Katrina, YouTube launch, London bombings, Pope John Paul II death', count: 80 },
  { category: 'Most Searched 2006',     prompt: 'List 80 most searched topics in 2006 including Saddam Hussein execution, North Korea nuclear test, Twitter launch, iPhone rumors', count: 80 },
  { category: 'Most Searched 2007',     prompt: 'List 80 most searched topics in 2007 including iPhone launch, Virginia Tech shooting, Harry Potter final book, global financial warning signs', count: 80 },
  { category: 'Most Searched 2008',     prompt: 'List 80 most searched topics in 2008 including global financial crisis, Barack Obama election, Beijing Olympics, Mumbai attacks', count: 80 },
  { category: 'Most Searched 2009',     prompt: 'List 80 most searched topics in 2009 including Michael Jackson death, H1N1 pandemic, Bitcoin whitepaper, Iranian Green Revolution', count: 80 },
  { category: 'Most Searched 2010',     prompt: 'List 80 most searched topics in 2010 including Haiti earthquake, BP oil spill, iPad launch, World Cup South Africa, Wikileaks', count: 80 },
  { category: 'Most Searched 2011',     prompt: 'List 80 most searched topics in 2011 including Arab Spring, Osama bin Laden death, Japan earthquake and tsunami, Royal Wedding', count: 80 },
  { category: 'Most Searched 2012',     prompt: 'List 80 most searched topics in 2012 including Sandy Hook shooting, London Olympics, Felix Baumgartner space jump, Hurricane Sandy', count: 80 },
  { category: 'Most Searched 2013',     prompt: 'List 80 most searched topics in 2013 including Boston Marathon bombing, Edward Snowden leaks, Pope Francis election, Typhoon Haiyan', count: 80 },
  { category: 'Most Searched 2014',     prompt: 'List 80 most searched topics in 2014 including MH370 disappearance, Ebola outbreak, ISIS rise, Ice Bucket Challenge, Ferguson protests', count: 80 },
  { category: 'Most Searched 2015',     prompt: 'List 80 most searched topics in 2015 including Paris attacks, Syrian refugee crisis, Charlie Hebdo, Marriage equality USA, Nepal earthquake', count: 80 },
  { category: 'Most Searched 2016',     prompt: 'List 80 most searched topics in 2016 including Brexit vote, Donald Trump election, Pokémon Go, Rio Olympics, David Bowie death', count: 80 },
  { category: 'Most Searched 2017',     prompt: 'List 80 most searched topics in 2017 including Hurricane Harvey Irma Maria, Las Vegas shooting, MeToo movement, Bitcoin surge', count: 80 },
  { category: 'Most Searched 2018',     prompt: 'List 80 most searched topics in 2018 including Thailand cave rescue, Cambridge Analytica, Meghan Markle royal wedding, Jamal Khashoggi', count: 80 },
  { category: 'Most Searched 2019',     prompt: 'List 80 most searched topics in 2019 including Notre Dame fire, Hong Kong protests, Game of Thrones finale, Area 51 meme, Amazon fires', count: 80 },


  // ── MOST SEARCHED TOPICS EVER ─────────────────────────────────
  { category: 'Most Searched 2020', prompt: 'List 100 most searched topics on Google worldwide in 2020 including coronavirus, elections, celebrities, events, and trends', count: 100 },
  { category: 'Most Searched 2021', prompt: 'List 100 most searched topics on Google worldwide in 2021 including COVID vaccines, celebrities, sports events, crypto, and viral moments', count: 100 },
  { category: 'Most Searched 2022', prompt: 'List 100 most searched topics on Google worldwide in 2022 including World Cup, Queen Elizabeth death, Ukraine war, and major events', count: 100 },
  { category: 'Most Searched 2023', prompt: 'List 100 most searched topics on Google worldwide in 2023 including AI ChatGPT, celebrities, sports, movies, and major events', count: 100 },
  { category: 'Most Searched 2024', prompt: 'List 100 most searched topics on Google worldwide in 2024 including elections, AI, sports, entertainment, and major world events', count: 100 },
  { category: 'Trending Questions',prompt: 'List 200 most commonly asked questions humans search for like how does X work, what is X, why does X happen, who invented X', count: 200 },
  { category: 'How Does It Work',  prompt: 'List 200 popular how does it work questions about everyday things like how does WiFi work, how do vaccines work, how does GPS work', count: 200 },
  { category: 'Why Questions',     prompt: 'List 200 popular why questions people search including why is the sky blue, why do we dream, why do we yawn, scientific explanations', count: 200 },
  { category: 'What Is Questions', prompt: 'List 300 popular what is questions people search about science, history, health, technology, and everyday life', count: 300 },

  
  // ══════════════════════════════════════════════════════════════
  // ADDITIONAL ENCYCLOPEDIA TOPICS
  // ══════════════════════════════════════════════════════════════
  { category: 'Phobias',               prompt: 'List 150 phobias with their official names, what they involve, and their etymology', count: 150 },
  { category: 'Syndromes',             prompt: 'List 100 named medical and psychological syndromes with their characteristics and history', count: 100 },
  { category: 'Paradoxes',             prompt: 'List 80 famous paradoxes in philosophy, logic, mathematics, and physics', count: 80 },
  { category: 'Logical Puzzles',       prompt: 'List 60 famous logical puzzles and brainteasers with their solutions', count: 60 },
  { category: 'Brain Teasers',         prompt: 'List 60 classic brain teasers and riddles from different cultures', count: 60 },
  { category: 'Optical Illusions',     prompt: 'List 60 famous optical illusions and visual phenomena with explanations', count: 60 },
  { category: 'Famous Experiments',    prompt: 'List 100 most famous scientific experiments in history with their results and significance', count: 100 },
  { category: 'Scientific Instruments',prompt: 'List 100 important scientific instruments and devices with their history and use', count: 100 },
  { category: 'Units of Measurement',  prompt: 'List 150 units of measurement used across all fields including SI units, imperial units, and specialized units', count: 150 },
  { category: 'Colors',                prompt: 'List 150 colors with their hex codes, cultural meanings, and etymology of their names', count: 150 },
  { category: 'Shapes and Geometry',   prompt: 'List 100 geometric shapes, forms, and spatial concepts with definitions', count: 100 },
  { category: 'Gemstones',             prompt: 'List 100 gemstones and precious minerals with their properties, history, and cultural significance', count: 100 },
  { category: 'Metals',                prompt: 'List 80 metals and alloys with their properties, history of discovery, and uses', count: 80 },
  { category: 'Fabrics and Textiles',  prompt: 'List 80 fabrics, textiles, and materials with their origins and properties', count: 80 },
  { category: 'Furniture and Design',  prompt: 'List 60 furniture styles, design movements, and iconic furniture pieces in history', count: 60 },
  { category: 'Games and Play',        prompt: 'List 100 famous games, board games, card games, and traditional games from around the world with their history', count: 100 },
  { category: 'Toys',                  prompt: 'List 80 most iconic toys and playthings throughout history with their cultural impact', count: 80 },
  { category: 'Hobbies',               prompt: 'List 100 hobbies and recreational activities people pursue worldwide', count: 100 },
  { category: 'Superstitions',         prompt: 'List 100 common superstitions from around the world with their origins and cultural context', count: 100 },
  { category: 'Folklore',              prompt: 'List 100 folklore tales, legends, and folk beliefs from different cultures', count: 100 },
  { category: 'Fairy Tales',           prompt: 'List 80 famous fairy tales and folk stories from around the world with their origins', count: 80 },
  { category: 'Nursery Rhymes',        prompt: 'List 60 famous nursery rhymes with their origins and hidden historical meanings', count: 60 },
  { category: 'National Dishes',       prompt: 'List 195 national dishes and signature foods from every country in the world', count: 195 },
  { category: 'National Animals',      prompt: 'List 195 national animals, birds, and symbols for every country in the world', count: 195 },
  { category: 'National Anthems',      prompt: 'List 100 national anthems with their history and key lyrics themes', count: 100 },
  { category: 'Currencies',            prompt: 'List all world currencies with their countries, symbols, and history', count: 150 },
  { category: 'Time Zones',            prompt: 'List all major time zones of the world with their offsets and regions', count: 50 },
  { category: 'Calendars',             prompt: 'List 40 calendar systems used throughout history and around the world', count: 40 },
  { category: 'Number Systems',        prompt: 'List 30 numeral systems and number notations used throughout history including Roman, Arabic, Mayan, Binary, Hexadecimal', count: 30 },
  { category: 'Maps and Cartography',  prompt: 'List 60 concepts in cartography, map making, and geographic information systems', count: 60 },
  { category: 'Borders and Territories',prompt:'List 80 notable border disputes, contested territories, and geopolitical boundary issues worldwide', count: 80 },

]



// ── AI System Prompt ──────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Forcapedia's verified knowledge engine.

Generate a deep, comprehensive, encyclopedic article — Wikipedia-level depth and quality.
Write for an educated general audience: precise, authoritative, and clear.

Return ONLY valid JSON — no markdown, no explanation, no code blocks. Just raw JSON:
{
  "title": "Full article title",
  "summary": "2-3 sentence overview of the topic",
  "category": "One of: History, Science, Technology, Finance, Geopolitics, Culture, Sport, Other",
  "tags": ["tag1", "tag2", "tag3"],
  "sources": ["Source Name (https://homepage-url.com)", "Another Source (https://url.com)"],
  "content": "<h2>Section Title</h2><p>Paragraph one.</p><p>Paragraph two.</p><h2>Another Section</h2><p>Content...</p>"
}

Content rules:
- Use ONLY these HTML tags: h2, h3, p, ul, li, strong
- Minimum 6 distinct h2 sections (aim for 7-8)
- Each section: 2-4 short paragraphs of 3-5 sentences each
- Short paragraphs — never one long wall of text
- Use h3 sub-sections where the topic has meaningful sub-categories
- Total article length: 1200-2000 words minimum

Sources rules:
- 3 to 5 authoritative sources
- Format EXACTLY as: "Full Source Name (https://official-homepage.com)"
- Use real, well-known institution homepages only (e.g. NASA, Wikipedia, BBC, Nature, WHO)
- Never invent or guess specific article URLs — homepage URLs only
- If you are not certain of a homepage URL, omit the URL: "Source Name"

General rules:
- Be factual. Never speculate or hallucinate dates, statistics, or names.
- Return ONLY the JSON object. Nothing else.`

// ── Helpers ───────────────────────────────────────────────────────
function toSlug(str) {
  return str.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseArticle(raw, providerName) {
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = fence[1].trim()
  const objStart = text.indexOf('{')
  const objEnd   = text.lastIndexOf('}')
  if (objStart === -1 || objEnd === -1) throw new Error(`${providerName}: no JSON object found`)
  const parsed = JSON.parse(text.slice(objStart, objEnd + 1))
  if (!parsed.title || !parsed.content || !parsed.summary) {
    throw new Error(`${providerName}: missing required fields`)
  }
  return {
    title:    String(parsed.title),
    summary:  String(parsed.summary),
    content:  String(parsed.content),
    category: String(parsed.category ?? 'Other'),
    tags:     Array.isArray(parsed.tags)    ? parsed.tags.map(String)    : [],
    sources:  Array.isArray(parsed.sources) ? parsed.sources.map(String) : [],
  }
}

// ── Call one provider ─────────────────────────────────────────────
async function callProvider(provider, topic) {
  const res = await fetch(provider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model:           provider.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `Write a verified knowledge article about: ${topic}` },
      ],
      max_tokens:      5000,
      temperature:     0.2,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(60_000), // 60s timeout per provider
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 150)}`)
  }

  const data = await res.json()
  const raw  = data?.choices?.[0]?.message?.content ?? ''
  if (!raw.trim()) throw new Error('Empty response')

  return parseArticle(raw, provider.name)
}

// ── Generate with fallback chain ──────────────────────────────────
async function generateArticle(topic) {
  const errors = []

  for (const provider of configuredProviders) {
    try {
      const article = await callProvider(provider, topic)
      return { article, usedProvider: provider.name }
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`)
    }
  }

  throw new Error(`All providers failed:\n  ${errors.join('\n  ')}`)
}

// ── Generate a topic list from a category seed ────────────────────
// Asks the AI to list N topics for a given category.
// Returns a clean string array. Falls back to [] on any error.
async function generateTopicList(seed) {
  // Wrap in a JSON object so response_format: json_object works reliably
  const listPrompt = `${seed.prompt}.
Return ONLY valid JSON with this exact format — no markdown, no explanation:
{"topics": ["Topic One", "Topic Two", "Topic Three"]}
Aim for exactly ${seed.count} items in the topics array.`

  for (const provider of configuredProviders) {
    try {
      const res = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model:           provider.model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that responds only with valid JSON.' },
            { role: 'user',   content: listPrompt },
          ],
          max_tokens:      8000,
          temperature:     0.3,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      let raw = (data?.choices?.[0]?.message?.content ?? '').trim()

      // Strip markdown fences if present
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (fence) raw = fence[1].trim()

      const parsed = JSON.parse(raw)
      // Accept {"topics": [...]} or direct array
      const arr = Array.isArray(parsed) ? parsed : (parsed.topics ?? parsed[Object.keys(parsed)[0]])
      if (!Array.isArray(arr)) throw new Error('No topics array in response')

      const topics = arr
        .map(t => String(t).trim())
        .filter(t => t.length > 1 && t.length < 120)

      console.log(`✓ ${seed.category}: ${topics.length} topics via ${provider.name}`)
      return topics
    } catch (err) {
      console.log(`✗ ${provider.name} failed for "${seed.category}": ${err.message}`)
    }
  }

  console.log(`✗ All providers failed for "${seed.category}" — skipping`)
  return []
}

// ── CLI argument parser ───────────────────────────────────────────
function parseArgs() {
  const args   = process.argv.slice(2)
  const result = {
    mode:       'all',   // 'all' | 'static' | 'categories' | 'cat'
    cats:       [],      // specific category names (--cat Animals,Films)
    limit:      null,    // max articles to generate (--limit 50)
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🚀  Forcapedia Seed Script — Usage

  node scripts/seed.mjs                         Run everything (static + all categories)
  node scripts/seed.mjs --static                Only the built-in TOPICS list
  node scripts/seed.mjs --categories            Only AI-generated category lists
  node scripts/seed.mjs --cat Animals,Films     Specific categories only (comma-separated)
  node scripts/seed.mjs --limit 50              Cap how many articles to generate (test mode)

  Combine flags freely:
  node scripts/seed.mjs --static --limit 10     First 10 static topics only
  node scripts/seed.mjs --cat Books --limit 5   5 articles from the Books category

  Available categories: ${CATEGORY_SEEDS.map(s => s.category).join(', ')}
`)
    process.exit(0)
  }

  if (args.includes('--static'))     result.mode = 'static'
  if (args.includes('--categories')) result.mode = 'categories'

  const catIdx = args.indexOf('--cat')
  if (catIdx !== -1 && args[catIdx + 1]) {
    result.mode = 'cat'
    result.cats = args[catIdx + 1].split(',').map(c => c.trim())
  }

  const limIdx = args.indexOf('--limit')
  if (limIdx !== -1 && args[limIdx + 1]) {
    const n = parseInt(args[limIdx + 1], 10)
    if (!isNaN(n) && n > 0) result.limit = n
  }

  return result
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs()

  console.log(`\n🚀  Forcapedia Seed Script`)
  console.log(`🤖  Providers: ${configuredProviders.map(p => p.name).join(' → ')}`)
  console.log(`🎛️   Mode: ${opts.mode}${opts.cats.length ? ` (${opts.cats.join(', ')})` : ''}${opts.limit ? `  Limit: ${opts.limit}` : ''}`)
  console.log(`─────────────────────────────────────────`)

  // ── Step 1: Build topic list based on mode ─────────────────────
  let staticTopics = []
  let aiTopics     = []

  // Which static topics to include
  if (opts.mode === 'all' || opts.mode === 'static') {
    staticTopics = [...TOPICS]
  }

  // Which category seeds to fetch
  let seedsToRun = []
  if (opts.mode === 'all')        seedsToRun = CATEGORY_SEEDS
  if (opts.mode === 'categories') seedsToRun = CATEGORY_SEEDS
  if (opts.mode === 'cat') {
    const unknown = opts.cats.filter(c => !CATEGORY_SEEDS.find(s => s.category.toLowerCase() === c.toLowerCase()))
    if (unknown.length) {
      console.error(`❌  Unknown categories: ${unknown.join(', ')}`)
      console.error(`    Available: ${CATEGORY_SEEDS.map(s => s.category).join(', ')}`)
      process.exit(1)
    }
    seedsToRun = CATEGORY_SEEDS.filter(s => opts.cats.some(c => c.toLowerCase() === s.category.toLowerCase()))
  }

  if (seedsToRun.length > 0) {
    console.log(`\n📋  Fetching ${seedsToRun.length} AI-generated topic list(s)...\n`)
    for (const seed of seedsToRun) {
      process.stdout.write(`   ⏳ ${seed.category} (${seed.count} topics)... `)
      const generated = await generateTopicList(seed)
      aiTopics = aiTopics.concat(generated)
      await sleep(4000) // 4s between list calls — avoids Groq 429 rate limit
    }
  }

  // ── Step 2: Merge + deduplicate by slug ────────────────────────
  const allTopics = [...staticTopics, ...aiTopics]

  const seen = new Set()
  let deduped = allTopics.filter(t => {
    const slug = toSlug(t)
    if (seen.has(slug)) return false
    seen.add(slug)
    return true
  })

  // Apply --limit cap
  if (opts.limit && deduped.length > opts.limit) {
    console.log(`\n⚡  --limit applied: capping ${deduped.length} → ${opts.limit} topics`)
    deduped = deduped.slice(0, opts.limit)
  }

  console.log(`\n─────────────────────────────────────────`)
  console.log(`📚  Static topics:    ${staticTopics.length}`)
  console.log(`🤖  AI-generated:     ${aiTopics.length}`)
  console.log(`✨  Total after dedup: ${deduped.length}`)
  console.log(`─────────────────────────────────────────\n`)

  if (deduped.length === 0) {
    console.log('ℹ️   Nothing to seed. Check your flags with --help')
    return
  }

  let success = 0
  let skipped = 0
  let failed  = 0

  for (let i = 0; i < deduped.length; i++) {
    const topic = deduped[i]
    const slug  = toSlug(topic)
    const num   = `[${String(i + 1).padStart(String(deduped.length).length, '0')}/${deduped.length}]`

    // Skip if already in DB
    const { data: existing } = await supabase
      .from('articles')
      .select('slug')
      .eq('slug', slug)
      .single()

    if (existing) {
      console.log(`${num} ⏭  Skipped: ${topic}`)
      skipped++
      continue
    }

    process.stdout.write(`${num} ⏳  ${topic} ... `)

    try {
      const { article, usedProvider } = await generateArticle(topic)

      const { error } = await supabase.from('articles').insert({
        slug,
        title:       article.title,
        summary:     article.summary,
        content:     article.content,
        category:    article.category,
        tags:        article.tags,
        sources:     article.sources,
        verified_at: new Date().toISOString(),
        created_by:  null,
      })

      if (error && error.code !== '23505') throw new Error(error.message)

      console.log(`✓  (${usedProvider})`)
      success++
    } catch (err) {
      console.log(`✗ FAILED`)
      console.error(`    → ${err.message}`)
      failed++
    }

    // 2s gap between requests — keeps Groq free tier happy
    if (i < deduped.length - 1) await sleep(2000)
  }

  console.log(`\n─────────────────────────────────────────`)
  console.log(`✅  Done!  Success: ${success}  Skipped: ${skipped}  Failed: ${failed}`)
  console.log(`─────────────────────────────────────────\n`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
