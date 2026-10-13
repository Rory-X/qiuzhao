package runner

import "example.com/capstone-ai-gateway-agent-runtime/internal/agent/tool"

type CommandType string

const (
	CommandCallTool CommandType = "call_tool"
	CommandAnswer   CommandType = "answer"
)

type Command struct {
	Type CommandType
	Tool *tool.Call
	Text string
}

func CallTool(id string, name string, input string) Command {
	return Command{Type: CommandCallTool, Tool: &tool.Call{ID: id, Name: name, Input: input}}
}

func Answer(text string) Command {
	return Command{Type: CommandAnswer, Text: text}
}
