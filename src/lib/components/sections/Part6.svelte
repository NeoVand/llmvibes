<script lang="ts">
	import { Microscope, Crosshair, Wrench, Brain } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import Code from '../ui/Code.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import MermaidDiagram from '../ui/MermaidDiagram.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
</script>

<section id="part-6" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={Microscope}
			partLabel="Part 6"
			title="World Models"
			color="var(--color-primary)"
		/>

		<blockquote
			class="my-8 border-l-4 py-1 pl-5 text-lg italic"
			style="color: var(--color-text-secondary); border-color: var(--color-primary); font-family: var(--font-heading);"
		>
			"The model has never seen a board. Open it up, and there one is — maybe."
		</blockquote>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			Rook has only ever seen move tokens — never a board. So does it secretly have one? This
			chapter opens the model up and looks: the course's interpretability interlude, and the reason
			a chess model earned a place beside a storyteller.
		</p>

		<Callout type="note" title="Hands-on">
			Probing and patching labs on your own Rook arrive with the flagship milestone — they need the
			bigger offline-trained model to be worth dissecting. This chapter teaches the published
			science those labs will reproduce, so read it as the lab manual for an experiment you'll run.
		</Callout>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			Frame the stakes first. In Part 5 you watched next-token prediction produce competence, and
			the skeptic's reading is available and respectable: maybe it's all surface statistics —
			enormously sophisticated autocomplete that never models the world behind the tokens, a
			"stochastic parrot." For stories, the question is hard to even pose crisply. That's why the
			chess bird exists: a game of chess written as move tokens has a precise hidden world — the
			board — and we can check, mechanically, whether a model trained only on the tokens built the
			world inside itself. This is the cleanest version science currently has of the question
			<em>"does a language model understand?"</em>
		</p>

		<div id="section-6-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Crosshair}
				title="6.1 Linear Probes"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Train a tiny classifier on Rook's residual stream and it can read off the full board state —
				every square, at every move — from activations that were never told the rules. A linear
				probe is the simplest possible microscope, and what it finds here is remarkable.
			</p>

			<Callout type="note">
				<strong>The Problem:</strong> "Does the model represent the board?" sounds philosophical.
				Make it operational: after the model reads <Code code="e2e4 e7e5 g1f3" />, its residual
				stream (Part 3) holds a vector at every position. If the board is in there, it should be
				<em>extractable</em> from those vectors. Extraction is an experiment, and experiments have
				answers.
			</Callout>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The Simplest Possible Microscope
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				A <strong style="color: var(--color-text);">linear probe</strong> is a single linear layer —
				a multiply-and-add, the least powerful classifier worth naming — trained to predict some
				fact from a frozen activation vector. For chess: freeze the trained model, run games
				through it, collect the residual-stream vector after each move token, and train one tiny
				probe per square of the board to answer "what's on this square right now?"
			</p>

			<CodeBlock
				title="The probing recipe"
				lang="text"
				code={`1. Freeze the trained model — no weights change.
2. Run thousands of games through it; save the residual-stream
   vector at every move token.
3. Label each vector with the TRUE board state at that moment
   (a rules engine replays the game — the model never sees this).
4. For each square, fit a LINEAR classifier: activation → contents.
5. Test on games the probe never saw.`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The probe's weakness is the whole point. A deep probe could compute the board <em>itself</em>
				from almost any input, telling you nothing. A linear probe can only succeed if the
				information is already sitting in the activations in essentially explicit, linearly
				readable form. A probe is a stethoscope, not a surgeon.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				What the Experiments Found
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The landmark result is Othello-GPT (Li et al., 2023): a GPT trained purely on Othello move
				sequences — no rules, no board, just legal games — from which probes recovered the full
				board state at every move. Kenneth Li and colleagues concluded the model had built an
				<strong style="color: var(--color-text);">emergent world model</strong>: an internal board
				it computes, move by move, because tracking the board is the effective way to predict legal
				continuations. Adam Karvonen (2024) then showed the same for real chess: a GPT trained on
				raw game text, probes decoding the position of every piece with high accuracy — and, as a
				bonus, probes could read off an estimate of the <em>players' skill level</em> from the
				activations. The model wasn't just tracking the board; it was tracking who was at it.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The control experiment matters: run the same probes on a randomly initialized,
				never-trained copy of the model and they fail. Whatever the probes are reading, training
				put it there.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The Mine/Theirs Twist
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Early Othello-GPT probes only worked well if they were <em>nonlinear</em> — a puzzle,
				since it suggested the board wasn't stored plainly. Neel Nanda's follow-up dissolved the
				puzzle with a reframe: probe not for "black piece / white piece" but for
				<strong style="color: var(--color-text);">mine / theirs</strong> — relative to whoever
				moves next — and suddenly plain linear probes work excellently. The model doesn't store an
				observer's board; it stores a <em>player's</em> board, re-encoded every ply from the
				current mover's perspective. Which makes sense: "my pieces can move, theirs block me" is
				the frame next-move prediction actually needs. Lesson for every interpretability attempt
				you'll ever make: when a probe fails, the concept may be there in a coordinate system you
				didn't think to try. The model owes you nothing about <em>your</em> ontology.
			</p>

			<Callout type="note" title="Rook's turn comes later">
				These published results are on other people's models. Rook's UCI move tokens make it an
				unusually clean probing target — every single token defines a complete board state to
				predict. Probe training on flagship Rook, square by square on your screen, ships with the
				flagship milestone.
			</Callout>
		</div>

		<div id="section-6-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Wrench}
				title="6.2 Activation Patching"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Reading is one thing; editing is proof. Reach into a forward pass, flip the model's belief
				about a single square, and watch its chosen move change to match the board it now believes
				in — causal evidence that the internal board is doing real work.
			</p>

			<Callout type="warning">
				<strong>The Problem:</strong> A probe result is a correlation. Maybe the model
				<em>uses</em> its internal board to choose moves — or maybe the board is a passive
				by-product, computed and ignored, while moves come from somewhere else entirely. A car's
				windshield reflects the road without steering the car. To tell representation from
				decoration, you need an intervention.
			</Callout>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The Intervention
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The probe gives you more than a readout — it gives you a <em>direction</em>: the axis in
				activation space along which "this square holds my knight" varies. Activation patching
				uses that direction as a scalpel. Mid-forward-pass, capture the residual-stream vector,
				push it along the probe direction until the probe reports the belief you chose — knight
				gone, or moved elsewhere — then let the rest of the forward pass continue, computing on the
				edited belief.
			</p>

			<MermaidDiagram
				definition={`graph TD
  A(["Input: move tokens so far"]) --> B(["Layers 1..k run normally"])
  B --> C(["Capture residual-stream vector"])
  C --> D(["Edit it along the probe's direction:<br/>flip one square's contents"])
  D --> E(["Layers k+1..end run on the<br/>edited activation"])
  E --> F(["Compare: which move does the<br/>model choose now?"])`}
				id="activation-patching-flow"
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Then ask the only question that matters: did the <em>behavior</em> change to match the
				<em>edited belief</em>? It did. In Othello-GPT, patching the board representation made the
				model's legal-move predictions rearrange to fit the fictional board — including for board
				states that never occur in real games. Karvonen's chess models behave the same way: erase
				the model's belief in a piece, and its move distribution updates the way a player's would
				if the piece genuinely weren't there.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Why This Is the Gold Standard
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				This is the interpretability equivalent of a controlled experiment: hold the input fixed,
				change one internal variable, observe the output shift — causal, not correlational. The
				representation isn't just present; it is <em>load-bearing</em>. Cut the chain at the board
				belief and the move follows the belief, not the input. Note the equipment list, though:
				patching needs a forward pass you can capture and modify mid-flight — a "hooked" forward —
				which is precisely the capability this course's engine work reserves for the flagship-Rook
				lab. When you run it, you'll place a knight where no knight is, and watch Rook defend
				against a phantom.
			</p>
		</div>

		<div id="section-6-3" class="mb-8">
			<SectionHeader
				level="section"
				icon={Brain}
				title="6.3 Board or Bag of Heuristics?"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Not everyone agrees the probe results mean "world model" — maybe it's a thousand shallow
				tricks that add up to one. The critique gets presented honestly, because how much models
				really understand is exactly the open question at the frontier.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Here's the strongest version of the counterargument, and it deserves your respect. Suppose
				the model learned not one board but thousands of local heuristics: "after this opening
				sequence, that square usually holds a knight," "if a pawn advanced two squares last move,
				the square behind it is empty," and on and on. Each is shallow. But superimpose enough of
				them and a probe could reconstruct the full board from their combined traces —
				<em>without the model containing anything you'd honestly call a board object</em>.
				Reconstructability is a fact about what's recoverable from the activations; "world model"
				is a claim about how the computation is organized. The probe can't tell them apart.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				This isn't hypothetical pedantry. A 2024 circuits-level reanalysis of Othello-GPT argued
				for exactly this reading — publishing under the phrase
				<strong style="color: var(--color-text);">"bag of heuristics"</strong>: the board-relevant
				computation decomposes into many small, redundant, special-case rules rather than one
				clean unified algorithm. Patching survives this critique, note — editing the activations
				would still shift behavior, because the heuristics' outputs live in those same
				activations. The debate is about organization, not about whether the probes and patches
				work.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The Tell: Edge Cases
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				If the model had a clean board plus rules, legality would be near-perfect everywhere. It
				isn't — quite. Chess-playing transformers still emit rare illegal moves, and the failures
				cluster exactly where local heuristics run out: <em>pins</em>, above all — a piece that
				looks free to move by every local pattern, except that moving it exposes its own king along
				a line crossing the whole board. A heuristic bag handles the common case and misses the
				global constraint; a genuine board-plus-rules engine wouldn't. Those rare blunders are the
				strongest single piece of evidence that whatever Rook-like models have, it isn't a crisp
				symbolic board with a rulebook attached.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Where That Leaves Us
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				A fair scoreboard. Established: board state is linearly decodable from move-trained
				models, in the mine/theirs frame; edits to it causally steer behavior; none of it exists in
				untrained models. Contested: whether that constitutes a unified world model or an
				aggregate of heuristics dense enough to imitate one — and whether, at some density, that
				distinction still marks a real difference. This is a live scientific debate; both camps
				accept the same experimental facts, and this course won't pretend a verdict that doesn't
				exist.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				And that's precisely why this chapter sits in a course about frontier models. "Does it
				truly model the world or just interpolate an enormous bag of heuristics?" is <em>the</em>
				argument people are having about the model you talked to this morning — usually with
				vibes for evidence. Rook is small enough to settle pieces of it with experiments you can
				run: probe, patch, and test the edge cases where the two stories come apart. When the
				flagship lab lands, you'll do all three — and you'll have earned an opinion.
			</p>

			<VibeBox
				prompts={[
					'Explain the difference between "the board is decodable from activations" and "the model uses a board" — and which experiment addresses which',
					'Devise an experiment on Rook that would count as evidence FOR the bag-of-heuristics view, not just against it',
					'Why do pinned pieces defeat heuristics that handle everything else?'
				]}
			/>
		</div>
	</div>
</section>
