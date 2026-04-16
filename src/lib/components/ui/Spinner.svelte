<script lang="ts">
  interface Props {
    size?: 'sm' | 'md' | 'lg';
    color?: string;
  }
  let { size = 'md', color = '#c9a84c' }: Props = $props();

  const sizeMap = { sm: 'w-5 h-5 border-2', md: 'w-9 h-9 border-2', lg: 'w-12 h-12 border-[3px]' };
</script>

<div
  class="rounded-full animate-spin border-t-[var(--spinner-color)] {sizeMap[size]}"
  style="
    --spinner-color: {color};
    border-color: {color}33;
    border-top-color: {color};
  "
></div>
