<script lang="ts">
	import { Bot, Hammer, StickyNote, Database, ShieldCheck } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import Code from '../ui/Code.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import MermaidDiagram from '../ui/MermaidDiagram.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
	import ToolCallTrace from '../lab/ToolCallTrace.svelte';
</script>

<section id="part-12" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader icon={Bot} partLabel="Part 12" title="Agents" color="var(--color-primary)" />

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			An agent is not a new kind of model — it's the same next-token predictor emitting tokens that
			make things happen. Quill gets two tools and a job long enough to need them: a story that
			outgrows its own context window. One honest flag before we start: this is the course's stretch
			chapter. The machinery is real and the lesson stands either way, but the live lab ships only
			if a prototype gate passes — can a model this small learn the tool grammar at all? If it
			can't, the demos here run driven by the tutor model instead, and they'll say so on screen.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-12-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Hammer}
				title="12.1 Tools as Tokens"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				A tool call is just a special token sequence the model learned to emit, and a tool result is
				just tokens spliced back into its context. Demystifying that loop — the same one under every
				"agentic" product — is the whole point of the chapter.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Strip the word "agent" of its marketing and ask what a language model can actually do. It
				emits tokens. That's the complete list. So how does it "look something up" or "take an
				action"? It writes a request in a format someone taught it, and a loop of ordinary code
				around it does the rest. You already have every ingredient: Part 2 put special tokens in the
				vocabulary, and Part 7 taught a model to respect a template built from them. Tool use is the
				same trick with a runtime listening.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Here is a raw token stream from a tool-using Quill, nothing hidden:
			</p>

			<CodeBlock
				title="A tool call is just tokens"
				lang="text"
				code={`...Mira pushed open the heavy door and stepped into the hall.
<|call|> lookup("dragon.name") <|end_call|>
                                   <-- sampling stops here
<|result|> Ember <|end_result|>    <-- the runtime splices this in
"Ember?" Mira whispered. The dragon lifted its head...`}
			/>

			<p class="mt-4 mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				A static trace hides the most important part: the <em>timing</em>. Play the same stream
				below at token speed and watch who is in charge at each instant — the model sampling, or the
				runtime executing.
			</p>

			<ToolCallTrace />

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Walk the mechanics in order, because each step kills a different piece of mystique:
			</p>

			<ul
				class="mb-4 list-inside list-disc space-y-1.5 text-[14px]"
				style="color: var(--color-text-secondary);"
			>
				<li>
					Mid-story, the model emits <Code code="<|call|>" />, then
					<Code code="lookup('dragon.name')" />, then <Code code="<|end_call|>" /> — each one an ordinary
					next-token prediction, sampled exactly like the word "door" was.
				</li>
				<li>
					The runtime — a while-loop watching the stream — recognizes
					<Code code="<|end_call|>" /> as a stop token and pauses sampling.
				</li>
				<li>
					The runtime executes the lookup with regular code. The model executes nothing. It has no
					hands; it wrote a note, and a program read it.
				</li>
				<li>
					The result comes back as tokens, wrapped in <Code code="<|result|>" /> markers, appended to
					the context.
				</li>
				<li>
					Sampling resumes. The fact "Ember" now sits in the context window, attended to like any
					other tokens — which is why the very next sentence can use the name.
				</li>
			</ul>

			<MermaidDiagram
				definition={`sequenceDiagram
    participant Q as Quill
    participant R as Runtime loop
    participant T as Tool
    Q->>R: emits call tokens, ends with the stop token
    R->>T: executes lookup("dragon.name")
    T->>R: returns "Ember"
    R->>Q: splices result tokens into the context
    Q->>Q: sampling resumes with the fact in view`}
				id="tool-call-loop"
			/>

			<Callout type="note" title="Every agent product is this loop">
				Function-calling APIs, MCP servers, coding agents running in your terminal — under each one
				sits this exact pattern: delimiter tokens (or a JSON schema playing the same role), a
				runtime that parses what the model wrote, and results spliced back as context. There is no
				new math anywhere in the stack. The model writes text; a program obeys it; the transcript
				grows.
			</Callout>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Where does the <em>ability</em> come from? Training data, same as everything else. The model
				sees traces containing tool-call tokens during fine-tuning and learns the pattern the way it
				learned dialogue formatting in Part 7 — when a dragon's name is needed and unknown, the
				high-probability continuation is <Code code="<|call|>" />. Which is exactly why this
				chapter's gate question is whether a bird this small can learn that grammar reliably.
				Section 12.4 returns to it.
			</p>
		</div>

		<div id="section-12-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={StickyNote}
				title="12.2 The Scratchpad"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Ask Quill for a story longer than its context window and it forgets its own characters
				mid-tale — the context limit from Part 3, now felt as pain. A note-taking tool is the fix,
				and the limitation itself is the lesson.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Make the pain concrete first. Quill's context window is a few hundred tokens — Part 3 showed
				you why: attention only runs over positions inside the window. Ask for a story twice that
				long and the opening slides out of view while the ending is still being written. The model
				cannot attend to tokens it can no longer see. The symptoms are exactly what you'd predict:
				the dragon quietly changes name, the lost locket is never found, a fresh protagonist wanders
				in around sentence forty. This is not a bug in Quill. It is the architecture doing precisely
				what the architecture does.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The fix is embarrassingly human: give it a place to write things down.
			</p>

			<CodeBlock
				title="Notes survive the window"
				lang="text"
				code={`[context begins — pinned notes, re-injected every step]
NOTE: protagonist Mira, brave, afraid of thunder
NOTE: dragon named Ember, guards the north tower
NOTE: open promise — Mira will return the locket

[...recent story tokens follow...]
...thunder rolled, and Mira froze on the stair.
<|call|> note("Mira reached the tower at nightfall") <|end_call|>
<|result|> saved <|end_result|>`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The mechanics matter: notes are stored <em>outside the model</em>, by the runtime, and
				re-injected at the top of every fresh context. The window still slides — nothing about the
				architecture changed — but the notes never leave it. Quill's job shifts from "remember
				everything" (impossible; the window is what it is) to "decide what is worth writing down"
				(learnable; it's just another token pattern with a payoff).
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Now look up from the toy. Frontier agents writing memory files, coding assistants keeping
				todo lists, chat products summarizing old conversation into a compact preamble — every one
				of these is this trick at scale. Context windows have grown a thousandfold, but the jobs
				grew too, and anything that must survive beyond the window has to live outside the model.
				The context limit isn't an inconvenience agents route around; it is the reason agent memory
				exists as a category.
			</p>

			<Callout type="tip" title="The limitation is the lesson">
				Notice what we didn't do: extend the window. We taught the model to live within it. That's
				the cheaper move at every scale, and it's the one the industry made — which is why you're
				learning it here rather than in an architecture chapter.
			</Callout>
		</div>

		<div id="section-12-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={Database}
				title="12.3 The Story-World Database"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The second tool lets Quill query facts about its story world — which character owns which
				dragon, what color the door was. Retrieval in miniature: the model looks things up instead
				of hallucinating them.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The scratchpad is freeform — the model writes whatever it deems important. The second tool
				is stricter: a structured store the story world lives in, with typed facts and stable keys.
			</p>

			<CodeBlock
				title="The story-world database"
				lang="yaml"
				code={`characters:
  mira:
    role: protagonist
    fear: thunder
  ember:
    kind: dragon
    color: copper
    home: north tower
objects:
  locket:
    owner: mira
    state: lost
  hall_door:
    color: blue`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The trained behavior: before writing about a thing, query it. About to describe the door?
				<Code code="lookup('hall_door.color')" /> first, write "blue" second. This is retrieval instead
				of recall — and it is RAG in miniature. Retrieval-augmented generation, the industry pattern where
				a model queries a document store before answering, has exactly this shape: fetch first, generate
				second, hallucinate less. Yours fits in a YAML file; the production version fits in a vector database;
				the loop is identical.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				But the deeper payoff isn't fewer hallucinations. It's this: once the facts live in a
				database, <em>consistency stops being a vibe and becomes checkable</em>. "Does this story
				feel consistent?" needs a judge — Part 5 taught you how expensive and slippery judged evals
				are. "Does this story call the door red when the database says blue?" needs a for-loop.
				You've moved a fuzzy literary property into checkmate territory.
			</p>

			<Callout type="note" title="Why this matters beyond storytelling">
				Moving a property from <em>judged</em> to <em>verified</em> is the general trick of the RLVR era.
				Every property you can move becomes trainable with Part 11's machinery — no reward model, no Goodhart
				tax on a learned proxy. The next section does exactly that to consistency.
			</Callout>
		</div>

		<div id="section-12-4" class="mb-8">
			<SectionHeader
				level="section"
				icon={ShieldCheck}
				title="12.4 Consistency Rewards"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Training the agent closes the course's loop: synthetic tool-use traces from Part 8's
				pipeline, then Part 11's RLVR with verifiers that hunt for contradictions between the story
				and the database. Every act of the course, compounded into one system.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Stage one: learn the grammar. A model this small won't invent tool syntax from a
				description, so we manufacture the demonstrations — Part 8's pipeline, pointed at a new
				target. The tutor model writes stories with tool calls woven in at plausible moments, the
				verifier stack filters out malformed calls and pointless ones, and Quill fine-tunes on the
				survivors. After SFT, <Code code="<|call|>" /> is a token pattern with learned habits around it,
				the same way chat formatting was after Part 7.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Stage two: sharpen with RLVR. Run Part 11's GRPO loop where the verifier is a consistency
				checker:
			</p>

			<CodeBlock
				title="A consistency reward"
				lang="js"
				code={`function reward(story, db) {
  const claims = extractClaims(story); // "the door was red", "Ember lives in the cellar"
  const contradictions = claims.filter((c) => contradicts(c, db));
  let r = 1.0 - 0.5 * contradictions.length; // each contradiction costs
  if (lookedUpBeforeClaiming(story)) r += 0.2; // reward checking first
  return r;
}`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Honesty about the load-bearing line: <Code code="extractClaims" /> is easy here and unsolved in
				general. Ours works because the schema is closed — colors, names, owners, places, a fixed cast
				— so claims can be pattern-matched against typed facts. Extracting arbitrary claims from arbitrary
				prose is an open research problem; if it were solved, half of Part 5's eval headaches wouldn't
				exist. Small worlds are what make verification honest.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				And that's precisely why this little chapter points at the actual frontier. Agentic training
				on verifiable rewards is where the field is right now: Kimi K2's post-training, for
				instance, built a synthetic tool-use factory — thousands of real and simulated tools,
				generated tasks and multi-turn traces rolled out in simulated environments, filtered for
				quality, then reinforced with verifiable signals where checks exist. Same shape as your
				pipeline: synthetic traces to teach the grammar, verifiers to sharpen the behavior. The
				difference between your story-world and their tool universe is — say it with me — exponents.
			</p>

			<Callout type="warning" title="Prototype-gated, and proud of it">
				This chapter compounds every act of the course, which makes it the most likely to break: it
				needs the tool grammar (this part), the synthetic pipeline (Part 8), and RLVR (Part 11) all
				working at once, at 25M parameters. The gate is real: if the prototype shows the tool
				grammar doesn't stick at this scale, the lab demotes to a guided demo driven by the tutor
				model — labeled as such on screen, never passed off as your bird. Either way you'll watch
				the loop run; what's gated is whether Quill runs it.
			</Callout>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Count the acts one more time: tokens and special vocabularies from Act I, a trained mind
				from Act II, SFT and synthetic data and verifiable rewards from Act III — assembled here
				into a system that writes, remembers, looks things up, and is graded by a program on whether
				its world holds together. That's an agent. It was never anything else.
			</p>

			<VibeBox
				prompts={[
					'Show me the exact token stream of a tool call, delimiters and all',
					"Why can't Quill just remember the whole story? Use my actual context window size",
					'What breaks first if the consistency verifier has a bug — and would I notice?'
				]}
			/>
		</div>
	</div>
</section>
