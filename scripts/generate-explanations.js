import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const QUESTIONS_PATH = join(__dirname, '../src/questions.json')
const SAVE_EVERY = 50
const DELAY_MS = 100  // ms between API calls to stay well under rate limits

const client = new Anthropic()  // reads ANTHROPIC_API_KEY from env

function isPlaceholder(explanation) {
  return !explanation || explanation.startsWith('See Microsoft AZ-900')
}

function buildPrompt(q) {
  const optionsList = q.options.join('\n')
  const correctText = q.options.find(o => o.startsWith(q.answer + '.'))

  return `You are writing a concise explanation for an AZ-900 certification exam question.

Question: ${q.question}

Options:
${optionsList}

Correct answer: ${q.answer}. ${correctText?.slice(3).trim() ?? ''}

Write 2-4 sentences that:
1. Explain why the correct answer (${q.answer}) is right
2. Briefly explain why each wrong option is incorrect

Rules:
- Be direct and exam-focused
- Do not start with "The correct answer is" — just explain
- Do not use bullet points or labels — write in plain prose
- Keep it under 80 words`
}

async function generateExplanation(q) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: buildPrompt(q) }],
  })
  return msg.content[0].text.trim()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const questions = JSON.parse(readFileSync(QUESTIONS_PATH, 'utf8'))
  const total = questions.length
  const toProcess = questions.filter(q => isPlaceholder(q.explanation))

  console.log(`Total questions: ${total}`)
  console.log(`Need explanations: ${toProcess.length}`)
  if (toProcess.length === 0) {
    console.log('All explanations already generated.')
    return
  }

  let done = 0
  let errors = 0

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    if (!isPlaceholder(q.explanation)) continue

    try {
      const explanation = await generateExplanation(q)
      questions[i] = { ...q, explanation }
      done++
      process.stdout.write(`\r[${done}/${toProcess.length}] ${q.id} ✓`)
    } catch (err) {
      errors++
      console.error(`\nFailed ${q.id}: ${err.message}`)
    }

    // Save progress periodically
    if (done % SAVE_EVERY === 0) {
      writeFileSync(QUESTIONS_PATH, JSON.stringify(questions, null, 2))
      console.log(`\n  → Saved progress (${done} done)`)
    }

    await sleep(DELAY_MS)
  }

  // Final save
  writeFileSync(QUESTIONS_PATH, JSON.stringify(questions, null, 2))
  console.log(`\n\nDone. ${done} generated, ${errors} errors.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
