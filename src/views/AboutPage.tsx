import "./about.css";
import { useLocale } from "../i18n";

// Editorial "about" page (/sobre). Long-form copy lives here per locale instead of the UI catalog.
const CONTENT = {
  "pt-BR": {
    back: "Voltar pro ino",
    kicker: "Sobre o nome",
    pronounce: "pronuncia-se Í-no",
    lead: "Ino é o nome original de Leucoteia, uma personagem da mitologia grega com uma participação muito bonita na Odisseia, de Homero. A história dela conversa direto com o que a gente quer fazer aqui.",
    originLabel: "01 — A origem",
    originTitle: "Uma princesa que foi parar no mar.",
    origin: [
      "Ino era uma princesa mortal, filha de Cadmo, rei de Tebas.",
      "Depois de uma sequência de tragédias na família, ela e o filho, Melicertes, acabam no mar. Os deuses transformam os dois em divindades marinhas.",
    ],
    transformations: [
      { from: "Ino", to: "Leucoteia", greek: "Λευκοθέα", note: "O nome quer dizer, mais ou menos, “deusa branca”." },
      { from: "Melicertes", to: "Palêmon", greek: "Παλαίμων", note: "Associado à proteção de quem navega." },
    ],
    odysseyLabel: "02 — Odisseia, canto V",
    odysseyTitle: "Odisseu à deriva.",
    odyssey: [
      "Poseidon provoca uma tempestade que destrói a embarcação de Odisseu.",
      "Ele fica à deriva, exausto, prestes a morrer afogado. É aí que Leucoteia aparece.",
    ],
    steps: [
      "Ela percebe que Odisseu está prestes a morrer.",
      "Oferece a ele um véu mágico — o krédemnon do poema.",
      "Orienta Odisseu a largar os destroços e nadar até a terra dos feácios.",
      "O véu protege ele durante a travessia.",
      "Em terra firme, Odisseu devolve o véu ao mar, do jeito que ela pediu.",
    ],
    quote: "Ela não faz a travessia por ele. Ela oferece proteção, orientação e os meios pra que ele chegue ao destino.",
    meaningLabel: "03 — E o que isso tem a ver com a gente",
    meaningTitle: "O ino não atravessa por ninguém. Ele segura o véu.",
    meaning: [
      { word: "Proteção", text: "Tuas respostas chegam na coordenação só no coletivo, nunca com teu nome. É o véu: dá pra ser sincero sem se expor." },
      { word: "Orientação", text: "Três perguntas, sexta sim, sexta não. Um ritmo simples pra ninguém se perder no mar de demandas." },
      { word: "Os meios", text: "A coordenação recebe sinais claros do time pra conversar melhor — mas a conversa, a travessia, é de vocês." },
    ],
    featuresLabel: "04 — Como funciona",
    featuresTitle: "Seis coisas pra saber.",
    features: [
      { title: "Sexta sim, sexta não", text: "O ciclo abre sexta às 9h e fecha domingo às 23h59, no horário de Fortaleza." },
      { title: "Três notas de 1 a 5", text: "Coordenação, equipe e trabalho. Se quiser, deixa um comentário — é opcional." },
      { title: "Mínimo de 3 respostas", text: "O resultado de um ciclo só aparece quando pelo menos três pessoas respondem. Abaixo disso, fica guardado." },
      { title: "Sem nome, sem hora, sem ordem", text: "A coordenação vê médias e comentários do grupo. Nunca quem respondeu, quando respondeu ou em que ordem." },
      { title: "Teu histórico é só teu", text: "Tu vê se participou de cada ciclo. Tuas notas e comentários não aparecem nem pra ti." },
      { title: "Administração sem espiar", text: "Quem administra cuida de pessoas, perfis e equipes — e não tem acesso às respostas." },
    ],
    closing: "A travessia é tua.",
    closingSmall: "O ino só segura o véu.",
  },
  en: {
    back: "Back to ino",
    kicker: "About the name",
    pronounce: "pronounced EE-no",
    lead: "Ino is the original name of Leucothea, a figure from Greek mythology with a beautiful part in Homer’s Odyssey. Her story speaks directly to what we want to do here.",
    originLabel: "01 — The origin",
    originTitle: "A princess who ended up at sea.",
    origin: [
      "Ino was a mortal princess, daughter of Cadmus, king of Thebes.",
      "After a string of family tragedies, she and her son, Melicertes, end up in the sea. The gods turn them both into sea deities.",
    ],
    transformations: [
      { from: "Ino", to: "Leucothea", greek: "Λευκοθέα", note: "Her name means, roughly, “white goddess”." },
      { from: "Melicertes", to: "Palaemon", greek: "Παλαίμων", note: "Associated with protecting sailors." },
    ],
    odysseyLabel: "02 — Odyssey, book V",
    odysseyTitle: "Odysseus adrift.",
    odyssey: [
      "Poseidon raises a storm that wrecks Odysseus’s raft.",
      "He drifts, exhausted, about to drown. That’s when Leucothea appears.",
    ],
    steps: [
      "She sees that Odysseus is about to die.",
      "She offers him a magic veil — the poem’s krēdemnon.",
      "She tells him to leave the wreckage and swim to the land of the Phaeacians.",
      "The veil protects him during the crossing.",
      "Safe on land, Odysseus returns the veil to the sea, as she asked.",
    ],
    quote: "She doesn’t make the crossing for him. She offers protection, guidance, and the means for him to reach his destination.",
    meaningLabel: "03 — What it has to do with us",
    meaningTitle: "ino doesn’t cross for anyone. It holds the veil.",
    meaning: [
      { word: "Protection", text: "Your answers reach coordination only as a group, never with your name. That’s the veil: honesty without exposure." },
      { word: "Guidance", text: "Three questions, every other Friday. A simple rhythm so nobody gets lost in a sea of requests." },
      { word: "The means", text: "Coordination gets clear signals from the team to have better conversations — but the conversation, the crossing, is yours." },
    ],
    featuresLabel: "04 — How it works",
    featuresTitle: "Six things to know.",
    features: [
      { title: "Every other Friday", text: "A cycle opens Friday at 9am and closes Sunday at 11:59pm, Fortaleza time." },
      { title: "Three scores from 1 to 5", text: "Coordination, team, and work. Add a comment if you want — it’s optional." },
      { title: "At least 3 answers", text: "A cycle’s results only appear when at least three people answer. Below that, they stay hidden." },
      { title: "No names, times, or order", text: "Coordination sees group averages and comments. Never who answered, when, or in what order." },
      { title: "Your history is yours", text: "You see whether you took part in each cycle. Your scores and comments don’t show up, not even for you." },
      { title: "Admins don’t peek", text: "Administrators manage people, profiles, and teams — and have no access to answers." },
    ],
    closing: "The crossing is yours.",
    closingSmall: "ino just holds the veil.",
  },
} as const;

export function AboutPage() {
  const { locale } = useLocale();
  const c = CONTENT[locale];
  return (
    <main id="main-content" className="about" lang={locale}>
      <header className="about-bar">
        <a className="about-bar__logo" href={`/?lang=${locale}`} aria-label={c.back}><img src="/assets/logo.svg" alt="" aria-hidden="true" /></a>
        <a className="about-bar__back" href={`/?lang=${locale}`}>{c.back}<span className="case-link__icon" aria-hidden="true" /></a>
      </header>

      <section className="about-hero" aria-labelledby="about-title">
        <p className="about-kicker">{c.kicker}</p>
        <h1 id="about-title" className="about-hero__word">Ino</h1>
        <p className="about-hero__pronounce"><span aria-hidden="true">/ˈiː.no/</span> {c.pronounce}</p>
        <p className="about-hero__lead">{c.lead}</p>
        <Veil className="about-hero__veil" />
      </section>

      <section className="about-block about-origin" aria-labelledby="about-origin">
        <p className="about-label">{c.originLabel}</p>
        <div className="about-columns">
          <h2 id="about-origin">{c.originTitle}</h2>
          <div className="about-copy">{c.origin.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        </div>
        <div className="about-transformations">
          {c.transformations.map((item) => (
            <article key={item.from} className="about-transform">
              <p className="about-transform__from">{item.from}</p>
              <span className="about-transform__arrow" aria-hidden="true" />
              <p className="about-transform__to">{item.to}</p>
              <p className="about-transform__greek" lang="el">{item.greek}</p>
              <p className="about-transform__note">{item.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-sea" aria-labelledby="about-odyssey">
        <Waves className="about-sea__waves" />
        <div className="about-sea__inner">
          <p className="about-label">{c.odysseyLabel}</p>
          <div className="about-columns">
            <h2 id="about-odyssey">{c.odysseyTitle}</h2>
            <div className="about-copy">{c.odyssey.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          </div>
          <ol className="about-steps">
            {c.steps.map((step, index) => <li key={step}><span className="about-steps__number" aria-hidden="true">{index + 1}</span><p>{step}</p></li>)}
          </ol>
          <blockquote className="about-quote"><p>{c.quote}</p></blockquote>
        </div>
      </section>

      <section className="about-block about-meaning" aria-labelledby="about-meaning">
        <p className="about-label">{c.meaningLabel}</p>
        <h2 id="about-meaning" className="about-meaning__title">{c.meaningTitle}</h2>
        <div className="about-meaning__grid">
          {c.meaning.map((item, index) => (
            <article key={item.word} className={`about-meaning__item about-meaning__item--${index + 1}`}>
              <h3>{item.word}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-block about-features" aria-labelledby="about-features">
        <p className="about-label">{c.featuresLabel}</p>
        <h2 id="about-features">{c.featuresTitle}</h2>
        <ul className="about-features__list">
          {c.features.map((feature) => (
            <li key={feature.title}>
              <span className="shell-icon" aria-hidden="true" />
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="about-closing" aria-label={c.closing}>
        <p className="about-closing__big">{c.closing}</p>
        <p className="about-closing__small">{c.closingSmall}</p>
        <a className="case-link about-closing__back" href={`/?lang=${locale}`}><span>{c.back}</span><span className="case-link__icon" aria-hidden="true" /></a>
      </section>
    </main>
  );
}

/** The krēdemnon: an original, abstract drawing of a veil carried by the sea wind over a gold sun. */
function Veil({ className }: { className: string }) {
  const strands = [
    { d: "M40 250 C 150 170, 250 310, 360 225 S 520 160, 590 235", width: 38 },
    { d: "M60 318 C 170 245, 265 370, 370 295 S 525 240, 575 305", width: 24 },
    { d: "M85 378 C 190 318, 280 420, 385 356 S 515 312, 555 362", width: 13 },
    { d: "M110 428 C 205 386, 290 458, 385 410 S 505 376, 535 414", width: 5 },
  ];
  return (
    <svg className={className} viewBox="0 0 600 600" aria-hidden="true" focusable="false">
      <circle cx="300" cy="300" r="250" fill="var(--gold)" />
      {strands.map((strand, index) => (
        <path key={strand.d} className={`veil-strand veil-strand--${index + 1}`} d={strand.d} fill="none" stroke="var(--paper)" strokeWidth={strand.width} strokeLinecap="round" />
      ))}
      <path className="veil-strand veil-strand--thread" d="M30 205 C 140 130, 250 270, 360 185 S 520 120, 595 190" fill="none" stroke="var(--brand-blue)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Waves({ className }: { className: string }) {
  // 1500 wide inside a 1200 viewBox so the 300-unit roll loops seamlessly.
  const wave = "M0 40 Q 75 0 150 40 T 300 40 T 450 40 T 600 40 T 750 40 T 900 40 T 1050 40 T 1200 40 T 1350 40 T 1500 40 V 80 H 0 Z";
  return (
    <svg className={className} viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="wave wave--back" d={wave} fill="var(--gold)" />
      <path className="wave wave--front" d={wave} fill="var(--brand-blue)" transform="translate(0 12)" />
    </svg>
  );
}
