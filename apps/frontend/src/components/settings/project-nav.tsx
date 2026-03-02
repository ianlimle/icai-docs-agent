import { Link, useMatchRoute } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

interface NavItem {
	to: string;
	label: string;
}

const navItems: NavItem[] = [
	{ to: '/settings/project', label: 'Overview' },
	{ to: '/settings/project/workflow', label: 'Workflow' },
	{ to: '/settings/project/models', label: 'Models' },
	{ to: '/settings/project/agent', label: 'Agent' },
	{ to: '/settings/project/guardrails', label: 'Guardrails' },
	{ to: '/settings/project/team', label: 'Team' },
];

export function SettingsProjectNav() {
	const matchRoute = useMatchRoute();
	// Only show project nav when NOT on the projects list page
	const isProjectsListPage = matchRoute({ to: '/settings/projects' });

	// Don't render anything on the projects list page
	if (isProjectsListPage) {
		return null;
	}

	return (
		<nav className='flex flex-col gap-1 sticky top-8 h-fit min-w-[140px]'>
			{navItems.map((item) => {
				return (
					<Link
						key={item.to}
						to={item.to}
						className={cn('text-left px-3 py-1 text-sm rounded-md transition-colors')}
						activeOptions={{ exact: true }}
						activeProps={{
							className: cn('text-foreground font-medium bg-accent'),
						}}
						inactiveProps={{
							className: cn('text-muted-foreground hover:text-foreground hover:bg-accent/50'),
						}}
					>
						{item.label}
					</Link>
				);
			})}
		</nav>
	);
}
