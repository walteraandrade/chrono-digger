# Corpus

Three files:

- `pharos-1918.json`: public-domain trial testimony (Princip, Harrach, Potiorek).
- `pharos-1918-albertini.json`: copies of two Pharos chunks (Princip's Ciganović answers, p. 23–24) with `characterId` `albertini` and ids `pharos-1918-albertini-NN`. Albertini (d. 1941) read the trial record, so this is within his cut.
- `albertini-1953.json`: short quotes from Albertini (see below).

`pharos-1918.json`: array of chunks from Pharos (ed.), *Der Prozeß gegen die Attentäter von Sarajewo*, Berlin 1918 (public domain, https://archive.org/details/derprozessgegend01prin).

## Fields

- `id`: `pharos-1918-<characterId>-NN`
- `characterId`: `princip` | `harrach` | `potiorek` | `albertini` (retrieval filter)
- `sourceTitle`, `author`, `year`, `license` (`public-domain`), `language` (`de`)
- `location`: printed page number(s), e.g. `p. 30` or `p. 22–23` (not the archive.org leaf index)
- `url`: archive.org page viewer link to the first page of the chunk
- `passage`: German text, ~60-250 words, split at answer boundaries

## Provenance and cleaning

- Text from the archive.org OCR (`_djvu.xml`), mapped to printed pages through `_page_numbers.json`. The book is set in antiqua, so OCR is mostly good; the main error is the "tz" ligature read as `^`, `ß`, `g` or `j` (e.g. `je^t` -> `jetzt`).
- Doubtful passages were checked against the page scans (pp. 22, 24, 25, 26, 27, 30, 37, 43, 157, 158).
- Fixed: tz ligature, hyphenation at line ends, speaker labels, running heads, footnotes (dropped), footnote markers, stray `di` for `ch`, and diacritics on key names (Ciganović, Tankosić, Grabež, Čabrinović, Ilić, Popović, Čubrilović, Jovanović). Less central names (e.g. Grbić, Isaković) were restored only where the OCR showed an obvious `c`.
- Kept as printed: archaic spelling (`frug`), `niemad` (p. 43), `Es sagte:` (p. 27), `Das weiß nicht.` (p. 24).
- `[…]` marks a cut: courtroom stage directions (reactions of the hall, Princip's demeanour) removed from Harrach-02 and Princip chunk with "Auf wen haben Sie geschossen?".
- Princip chunks keep the interrogation Q&A with the original `Präs.:`/`Princ.:` labels; the answerer is Princip.

## Scope and freeze

Princip: only events up to the shots (planning, Belgrade, Ciganović, weapons, border journey, Tuzla/Sarajevo, waiting at the corner). Excluded: his answers after the first shot ("die Kugel ging anderswohin", police beating, regrets), the 28/06 interrogation, cyanide taken at arrest, suicide plans, war/trial matter.

Potiorek: ends before arrival at the Konak (no deaths). Harrach: ends at "Es ist nichts!" and the faint.

Hindsight words remain in the originals (`selige`, `hochselige`, `Attentäter`, `Mörder`-type framing of the court): the prompt layer must keep characters from using them as knowledge. Harrach-01 is Pharos' third-person summary of his protocol, not direct speech; the rest of Harrach is first person as read in court.

## Princip temporal cut (28/06/1914, just before 11:00)

Lines by other speakers (`Präs.:`, `Staatsanw.:`, etc.) that assert trial-time evidence or claims Princip could not know on 28/06 were cut with `[…]`: princip-18 ("wie Sie später hören werden", the Loznica find, Miško Jovanović as Narodna obrana agent, "wie Sie sie ausübten") and princip-25 ("Das wird bewiesen werden", Tankosić as Narodna obrana leader, "offizielle serbische Persönlichkeit", Narodna obrana role of the major). Questions that make Princip's answers understandable stay. No chunk was dropped.

## albertini-1953.json (copyright)

Luigi Albertini, *The Origins of the War of 1914*, vol. II, transl. Isabella M. Massey (Oxford, 1953), https://archive.org/details/albertinitheoriginsofthewar1914. License `copyright-short-quote`, `language` `en`, `year` 1953 (edition; the author died in 1941 and the text predates it).

- Copyright rule (CONTEXT.md, rule 1): each chunk is a short passage, well under one page (55–116 words); 10 chunks, about 880 words in total, far below 10% of the book. Do not add long blocks.
- Pages are the printed page numbers of the Greenwood photo-reprint of the OUP edition (`location`); check once against the OUP copy before publishing.
- Chunks: p. 46 (why Princip and Čubrilović did not fire at the first pass; the only route-related context Albertini gives, no change of route and no order to the driver), p. 47 (sentences, under twenty, ill, died before the war's end), p. 55 (Ciganović, Tankosić, Black Hand, "knocking at a door of the Black Hand", Princip's request for bombs), p. 90–91 (Ljuba Jovanovic's account that Pašić knew), p. 98 (Pašić and the warning to Vienna), p. 101, p. 103 ("Possibly the words were too general").
- Cleaning: OCR from the archive.org full text. Fixed running heads, hyphenation, scan noise. Names keep Albertini's spelling without diacritics (Cabrinovic, Ciganovic, Pasic, Tankosic). Cuts are marked `[…]`. Words kept exactly; a few garbled OCR words were restored from context (`conspirators`, `youths`, `instructions`, `imprisonment`).
