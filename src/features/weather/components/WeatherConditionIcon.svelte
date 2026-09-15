<script lang="ts">
import Cloud from "@lucide/svelte/icons/cloud";
import CloudDrizzle from "@lucide/svelte/icons/cloud-drizzle";
import CloudFog from "@lucide/svelte/icons/cloud-fog";
import CloudHail from "@lucide/svelte/icons/cloud-hail";
import CloudLightning from "@lucide/svelte/icons/cloud-lightning";
import CloudRain from "@lucide/svelte/icons/cloud-rain";
import CloudSnow from "@lucide/svelte/icons/cloud-snow";
import CloudSun from "@lucide/svelte/icons/cloud-sun";
import Cloudy from "@lucide/svelte/icons/cloudy";
import Sun from "@lucide/svelte/icons/sun";
import {
  type WeatherConditionInput,
  weatherConditionIcon,
} from "@/features/weather/weather-ui";

let {
  condition,
  class: className,
}: { condition?: WeatherConditionInput; class?: string } = $props();
const ICON_COMPONENTS = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  cloudy: Cloudy,
  "cloud-fog": CloudFog,
  "cloud-drizzle": CloudDrizzle,
  "cloud-rain": CloudRain,
  "cloud-snow": CloudSnow,
  "cloud-hail": CloudHail,
  "cloud-lightning": CloudLightning,
} as const;

const Icon = $derived(
  ICON_COMPONENTS[
    weatherConditionIcon(condition ?? { text: "", icon: "unknown" })
  ],
);
</script>

<Icon class={className} strokeWidth={1.5} aria-hidden="true" />
