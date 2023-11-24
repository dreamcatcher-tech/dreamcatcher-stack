export class OpenAIThread {
  #openai
  constructor(assistant_id, openai) {
    this.assistant_id = assistant_id
    this.eventWatchers = []
    this.functions = {}
    this.interval = null
    this.#openai = openai
  }

  async createThread() {
    try {
      const thread = await this.#openai.beta.threads.create()
      this.thread = thread
      return thread
    } catch (error) {
      console.error('Error creating thread:', error)
      throw error
    }
  }

  async createUserMessage(content) {
    try {
      const message = await this.#openai.beta.threads.messages.create(
        this.thread.id,
        {
          role: 'user',
          content,
        }
      )
      return message
    } catch (error) {
      console.error('Error creating user message:', error)
      throw error
    }
  }

  async runThread(instructions = '') {
    try {
      const run = await this.#openai.beta.threads.runs.create(this.thread.id, {
        assistant_id: this.assistant_id,
        instructions,
      })

      this.run = run

      await this.pollRun()

      this.interval = setInterval(() => this.pollRunInterval(), 1000)

      return run
    } catch (error) {
      console.error('Error running thread:', error)
      throw error
    }
  }

  async runThreadAndWait(instructions = '') {
    try {
      const run = await this.#openai.beta.threads.runs.create(this.thread.id, {
        assistant_id: this.assistant_id,
        instructions,
      })

      this.run = run

      await this.pollRun()

      this.interval = setInterval(() => this.pollRunInterval(), 1000)

      while (this.interval !== null) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      return run
    } catch (error) {
      console.error('Error running thread:', error)
      throw error
    }
  }

  async pollRunInterval() {
    try {
      const run = await this.pollRun()
      if (['completed', 'failed', 'cancelled'].includes(run.status)) {
        clearInterval(this.interval)
        this.interval = null
      }
    } catch (error) {
      clearInterval(this.interval)
      this.interval = null
      console.error('Error polling run:', error)
    }
  }

  registerEvent(event, callback) {
    this.eventWatchers.push({ event, callback })
  }

  registerFunction(functionName, callback) {
    this.functions[functionName] = callback
  }

  async getResponse() {
    try {
      const messages = await this.#openai.beta.threads.messages.list(
        this.thread.id
      )

      return messages.data[0]
    } catch (error) {
      console.error('Error getting response:', error)
      throw error
    }
  }

  async getMessages() {
    try {
      const messages = await this.#openai.beta.threads.messages.list(
        this.thread.id
      )

      return messages.data
    } catch (error) {
      console.error('Error getting messages:', error)
      throw error
    }
  }

  async pollRun() {
    try {
      const running = await this.#openai.beta.threads.runs.retrieve(
        this.thread.id,
        this.run.id
      )

      if (
        running.status === 'requires_action' &&
        running.required_action?.submit_tool_outputs?.tool_calls
      ) {
        const outputs =
          running.required_action.submit_tool_outputs.tool_calls.map(
            async (toolCall) => {
              if (toolCall.type !== 'function') {
                console.error(`Tool call type ${toolCall.type} not supported.`)
                return null // Skip non-function tool calls
              }

              const tool = this.functions[toolCall.function.name]
              if (!tool) {
                console.error(
                  `Function ${toolCall.function.name} not found. Did you forget to register it?`
                )
                return null // Skip if the function is not registered
              }

              try {
                // Assuming the tool functions are async, they should be awaited
                const output = await tool(
                  JSON.parse(toolCall.function.arguments)
                )
                return {
                  tool_call_id: toolCall.id,
                  output: JSON.stringify(output), // Assuming output should be stringified
                }
              } catch (error) {
                console.error(
                  `Error executing tool function ${toolCall.function.name}:`,
                  error
                )
                return null // Return null in case of an error
              }
            }
          )

        const resolvedOutputs = (await Promise.all(outputs)).filter(
          (output) => output !== null
        )

        if (resolvedOutputs.length > 0) {
          try {
            await this.#openai.beta.threads.runs.submitToolOutputs(
              this.thread.id,
              this.run.id,
              {
                tool_outputs: resolvedOutputs,
              }
            )
          } catch (error) {
            console.error('Error submitting tool outputs:', error)
          }
        }
      }

      for (const watcher of this.eventWatchers.filter(
        (watcher) => watcher.event === running.status
      )) {
        if (typeof watcher.callback === 'function') {
          await watcher.callback(running)
        }
      }

      return running
    } catch (error) {
      console.error('Error polling run status:', error)
      throw error
    }
  }
}
