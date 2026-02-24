/**
 * Format stage name for display
 */
export function formatStageName(stage: string): string {
	const stageNames: Record<string, string> = {
		tool_routing: 'Tool Routing',
		query_construction: 'Query Construction',
		tool_execution: 'Tool Execution',
		answer_generation: 'Answer Generation',
		citation: 'Citation',
	};
	return stageNames[stage] || stage;
}

/**
 * Format tool name for display
 */
export function formatToolName(tool: string): string {
	const toolNames: Record<string, string> = {
		grep: 'Grep',
		search: 'Search',
		read: 'Read',
		'execute-sql': 'Execute SQL',
		'execute-python': 'Execute Python',
		unknown: 'Unknown',
	};
	return toolNames[tool] || tool;
}
