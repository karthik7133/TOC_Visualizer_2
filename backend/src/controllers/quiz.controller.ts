import { Request, Response } from 'express';
import { ClaudeClient } from '../config/ai.config';

const claudeClient = new ClaudeClient();

// ── Quiz question shape ────────────────────────────────────────────────────────
export interface QuizQuestion {
  id: number;
  topic: string;
  question: string;
  options: string[];       // exactly 4 options, each like "A) ..."
  correctIndex: number;    // 0–3
  explanation: string;
}

// ── System prompt for quiz generation ────────────────────────────────────────
const QUIZ_SYSTEM_PROMPT = `You are a rigorous CS professor specializing in creating exam-quality multiple choice questions.
Your output must be ONLY a valid JSON array — no markdown, no code fences, no prose, no extra text.

Each element in the array is an object with exactly these fields:
{
  "id": <number starting at 1>,
  "topic": "<exact topic name as given>",
  "question": "<clear, unambiguous question text>",
  "options": ["A) <option>", "B) <option>", "C) <option>", "D) <option>"],
  "correctIndex": <0-3, index of the correct option in the options array>,
  "explanation": "<1-2 sentence explanation of why the correct answer is right>"
}

STRICT RULES:
1. Output ONLY the JSON array. Nothing before or after it.
2. Questions must be university-level: conceptual, not trivial.
3. Mix question types: definitions, examples, proofs/theorems, tracing, comparison.
4. All 4 options must be plausible — no obviously wrong answers.
5. Never repeat the same question.
6. For merged topics, create questions that explicitly compare or combine the two topics.
7. correctIndex must be 0, 1, 2, or 3 exactly.`;

const MOCK_QUESTIONS: Record<string, Omit<QuizQuestion, 'id'>[]> = {
  'DFA': [
    {
      topic: 'DFA',
      question: 'Which of the following is TRUE about Deterministic Finite Automata (DFA)?',
      options: [
        'A) For every state, there is exactly one transition for each input symbol.',
        'B) It can have multiple transitions for the same symbol from a single state.',
        'C) It can make transitions on empty input (epsilon).',
        'D) It is more powerful computationally than an NFA.'
      ],
      correctIndex: 0,
      explanation: 'By definition, a DFA must have exactly one deterministic transition from each state for each alphabet symbol, and it does not allow epsilon transitions.'
    },
    {
      topic: 'DFA',
      question: 'A DFA has a set of states Q. What is the maximum number of states in an equivalent minimized DFA?',
      options: [
        'A) 2^|Q|',
        'B) |Q|',
        'C) |Q| - 1',
        'D) 1'
      ],
      correctIndex: 1,
      explanation: 'A minimized DFA has at most the same number of states as the original DFA, and typically fewer.'
    },
    {
      topic: 'DFA',
      question: 'Which language is accepted by a DFA that accepts all binary strings containing an even number of 0s?',
      options: [
        'A) Regular language',
        'B) Context-free but not regular',
        'C) Context-sensitive but not context-free',
        'D) Recursive but not context-sensitive'
      ],
      correctIndex: 0,
      explanation: 'Counting modulo a constant (like even number of 0s) requires a finite number of states, which makes the language regular.'
    }
  ],
  'NFA': [
    {
      topic: 'NFA',
      question: 'What is the primary difference between an NFA and a DFA?',
      options: [
        'A) NFA can have epsilon transitions and multiple paths for a single input symbol.',
        'B) NFA can recognize non-regular languages.',
        'C) NFA does not have a finite number of states.',
        'D) NFA requires an infinite tape to execute.'
      ],
      correctIndex: 0,
      explanation: 'Non-deterministic Finite Automata (NFA) allow epsilon transitions and multiple possible transitions for the same input symbol from a state.'
    },
    {
      topic: 'NFA',
      question: 'If an NFA has k states, the equivalent DFA obtained using subset construction can have at most how many states?',
      options: [
        'A) k^2',
        'B) 2^k',
        'C) 2k',
        'D) k!'
      ],
      correctIndex: 1,
      explanation: 'Subset construction maps states of the DFA to subsets of the NFA states. For k states, there are 2^k possible subsets.'
    }
  ],
  'Regular Expressions': [
    {
      topic: 'Regular Expressions',
      question: 'Which of the following regular expressions represents the set of all binary strings ending in 01?',
      options: [
        'A) (0|1)*01',
        'B) 0*1*',
        'C) (01)*',
        'D) (0|1)*01(0|1)*'
      ],
      correctIndex: 0,
      explanation: '(0|1)* allows any prefix of 0s and 1s, and appending 01 at the end ensures the string ends in 01.'
    },
    {
      topic: 'Regular Expressions',
      question: 'What is the closure property of regular languages under the Kleene Star (*) operation?',
      options: [
        'A) Regular languages are closed under Kleene Star.',
        'B) Regular languages are not closed under Kleene Star.',
        'C) Only context-free languages are closed under Kleene Star.',
        'D) Closed only if the alphabet is binary.'
      ],
      correctIndex: 0,
      explanation: 'By Kleene\'s theorem, regular languages are closed under union, concatenation, and Kleene star operations.'
    }
  ],
  'CFG': [
    {
      topic: 'CFG',
      question: 'Which class of automata corresponds to Context-Free Grammars (CFG)?',
      options: [
        'A) Finite Automata (DFA/NFA)',
        'B) Pushdown Automata (PDA)',
        'C) Linear Bounded Automata (LBA)',
        'D) Turing Machines (TM)'
      ],
      correctIndex: 1,
      explanation: 'Pushdown Automata (PDA), which are finite automata equipped with an auxiliary stack memory, recognize exactly the context-free languages.'
    },
    {
      topic: 'CFG',
      question: 'What is an ambiguous grammar?',
      options: [
        'A) A grammar that has more than one leftmost derivation or parse tree for some string.',
        'B) A grammar that contains cycles of epsilon transitions.',
        'C) A grammar that cannot be parsed in linear time.',
        'D) A grammar that generates regular languages only.'
      ],
      correctIndex: 0,
      explanation: 'A grammar is ambiguous if there exists a string in its language that can produce more than one distinct parse tree (or leftmost/rightmost derivation).'
    }
  ],
  'PDA': [
    {
      topic: 'PDA',
      question: 'A Pushdown Automaton (PDA) can accept languages using which two methods?',
      options: [
        'A) Final state or Empty stack',
        'B) Stack overflow or Underflow',
        'C) Infinite loop or Epsilon transition',
        'D) Left-to-right scanning or Right-to-left scanning'
      ],
      correctIndex: 0,
      explanation: 'PDAs can be designed to accept strings either by reaching an accepting final state or by clearing the stack completely (empty stack).'
    },
    {
      topic: 'PDA',
      question: 'Is the class of deterministic PDAs (DPDAs) equivalent in power to non-deterministic PDAs?',
      options: [
        'A) No, non-deterministic PDAs can recognize more languages (e.g., even palindromes).',
        'B) Yes, similar to DFAs and NFAs.',
        'C) Yes, both recognize context-sensitive languages.',
        'D) No, DPDAs are more powerful.'
      ],
      correctIndex: 0,
      explanation: 'Unlike finite automata where DFA = NFA, deterministic PDAs are strictly weaker than non-deterministic PDAs. Non-regular context-free languages like even-length palindromes require non-determinism.'
    }
  ],
  'Turing Machine': [
    {
      topic: 'Turing Machine',
      question: 'What is the Church-Turing Thesis?',
      options: [
        'A) Any intuitive algorithm can be computed by a Turing Machine.',
        'B) Every language accepted by a Turing Machine is context-free.',
        'C) A Turing Machine cannot have more than 100 states.',
        'D) NP-complete problems can be solved in polynomial time.'
      ],
      correctIndex: 0,
      explanation: 'The Church-Turing Thesis asserts that our intuitive notion of algorithm/computation is precisely captured by Turing machines.'
    },
    {
      topic: 'Turing Machine',
      question: 'Which of the following problems is undecidable?',
      options: [
        'A) The Halting Problem for Turing Machines.',
        'B) Deciding if a string is accepted by a DFA.',
        'C) Deciding if a Context-Free Grammar is empty.',
        'D) Minimizing a DFA.'
      ],
      correctIndex: 0,
      explanation: 'The Halting Problem (determining if a Turing Machine halts on a given input) is the classic undecidable problem proved by Alan Turing.'
    }
  ]
};

// ── Controller ─────────────────────────────────────────────────────────────────
export async function generateQuizQuestions(req: Request, res: Response): Promise<void> {
  const { topics, count = 10, merge = false } = req.body as {
    topics: string[];
    count?: number;
    merge?: boolean;
  };

  const safeCount = Math.min(Math.max(Number(count) || 10, 3), 20);
  const topicLabel = merge && topics.length > 1
    ? `${topics.join(' + ')} (Merged)`
    : topics.join(', ');

  try {
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      res.status(400).json({ error: '`topics` must be a non-empty array of strings.' });
      return;
    }

    const mergeNote = merge && topics.length > 1
      ? `IMPORTANT: Questions must explicitly blend or compare concepts from ALL of: ${topics.join(', ')}. Label each question's topic as "${topics.join(' + ')}".`
      : topics.length > 1
        ? `Distribute the ${safeCount} questions evenly across topics. Roughly ${Math.floor(safeCount / topics.length)} questions per topic.`
        : `All questions are about: ${topics[0]}.`;

    const userPrompt = `Generate exactly ${safeCount} MCQ questions about: ${topicLabel}.
${mergeNote}
Return the result as a JSON array of ${safeCount} objects following the schema exactly.`;

    const raw = await claudeClient.generateWithSystem(
      QUIZ_SYSTEM_PROMPT,
      userPrompt,
      4096,
      0.2,
    );

    // Strip any accidental markdown fences
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let questions: QuizQuestion[];
    try {
      questions = JSON.parse(cleaned);
    } catch {
      // Try to extract array from the response
      const match = cleaned.match(/\[[\s\S]+\]/);
      if (!match) throw new Error('Claude returned non-JSON response for quiz.');
      questions = JSON.parse(match[0]);
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Claude returned an empty or non-array response.');
    }

    // Normalize IDs
    questions = questions.map((q, i) => ({ ...q, id: i + 1 }));

    console.log(`[Quiz] Generated ${questions.length} questions for: ${topicLabel}`);
    res.json({ questions, topics, merge, count: questions.length });

  } catch (err) {
    console.warn('[Quiz] Claude failed. Falling back to high-quality local mock questions.', err);

    // Generate mock questions
    const mockQuestionsList: QuizQuestion[] = [];
    let idCounter = 1;

    // Distribute count across selected topics
    while (mockQuestionsList.length < safeCount) {
      for (const topic of topics) {
        if (mockQuestionsList.length >= safeCount) break;

        const candidates = MOCK_QUESTIONS[topic] || MOCK_QUESTIONS['DFA'];
        // Pick one at random or cyclically
        const qIndex = Math.floor(Math.random() * candidates.length);
        const q = candidates[qIndex];

        // Check for duplicates
        const alreadyAdded = mockQuestionsList.some(mq => mq.question === q.question);
        if (alreadyAdded && mockQuestionsList.length < safeCount && mockQuestionsList.length > 5) {
          mockQuestionsList.push({
            id: idCounter++,
            topic: topic,
            question: `${q.question} (Alt)`,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation
          });
        } else {
          mockQuestionsList.push({
            id: idCounter++,
            topic: topic,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation
          });
        }
      }
    }

    res.json({
      questions: mockQuestionsList,
      topics,
      merge,
      count: mockQuestionsList.length,
      isMock: true
    });
  }
}
