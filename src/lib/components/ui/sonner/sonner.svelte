<script lang="ts">
	import { onMount } from "svelte";
	import { Toaster as Sonner, type ToasterProps as SonnerProps } from "svelte-sonner";
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
	import InfoIcon from '@lucide/svelte/icons/info';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	let { ...restProps }: SonnerProps = $props();
	let theme = $state<NonNullable<SonnerProps["theme"]>>("light");

	onMount(() => {
		const syncTheme = () => {
			theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
		};

		syncTheme();
		window.addEventListener('life-ustc-theme-change', syncTheme);
		return () => window.removeEventListener('life-ustc-theme-change', syncTheme);
	});
</script>

<Sonner
	{theme}
	class="toaster group"
	style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
	{...restProps}
>
	{#snippet loadingIcon()}
		<Loader2Icon class="size-4 animate-spin" />
	{/snippet}
	{#snippet successIcon()}
		<CircleCheckIcon class="size-4" />
	{/snippet}
	{#snippet errorIcon()}
		<OctagonXIcon class="size-4" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon class="size-4" />
	{/snippet}
	{#snippet warningIcon()}
		<TriangleAlertIcon class="size-4" />
	{/snippet}
</Sonner>

<style>
	:global([data-sonner-toaster]) {
		max-width: calc(100vw - var(--offset-left) - var(--offset-right));
		pointer-events: none;
	}

	:global([data-sonner-toast]) {
		pointer-events: none;
	}

	:global([data-sonner-toast] button),
	:global([data-sonner-toast] a),
	:global([data-sonner-toast] [role="button"]) {
		pointer-events: auto;
	}

	@media (max-width: 600px) {
		:global([data-sonner-toaster]) {
			max-width: calc(
				100vw - var(--mobile-offset-left) - var(--mobile-offset-right)
			);
		}
	}
</style>
