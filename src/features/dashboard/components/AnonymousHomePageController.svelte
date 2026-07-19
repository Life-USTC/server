<script lang="ts">
import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
import type { DashboardHomepageCopy } from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

type AnonymousHomePageData = {
  copy: {
    homepage: DashboardHomepageCopy;
    metadata: { home: string };
  };
  signedIn: false;
};

export let data: AnonymousHomePageData;
</script>

<svelte:head>
  <title>{data.copy.metadata.home} - Life@USTC</title>
</svelte:head>

<div class="mx-auto grid w-full max-w-5xl gap-6">
  <div class="grid gap-2">
    <h1 class="font-semibold text-3xl tracking-normal sm:text-4xl">
      {data.copy.homepage.publicDashboard.title}
    </h1>
    <p class="max-w-3xl text-muted-foreground">
      {data.copy.homepage.publicDashboard.description}
    </p>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>
        {data.copy.homepage.publicDashboard.cards.courses.title}
      </Card.Title>
      <Card.Description>
        {data.copy.homepage.publicDashboard.cards.courses.description}
      </Card.Description>
    </Card.Header>
    <Card.Footer>
      <Button href="/courses">
        {data.copy.homepage.publicDashboard.cards.courses.title}
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </Card.Footer>
  </Card.Root>

  <div class="grid gap-4 md:grid-cols-2">
    <Card.Root>
      <Card.Header>
        <Card.Title>
          {data.copy.homepage.publicDashboard.cards.sections.title}
        </Card.Title>
        <Card.Description>
          {data.copy.homepage.publicDashboard.cards.sections.description}
        </Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button href="/sections" variant="outline">
          {data.copy.homepage.publicDashboard.cards.sections.title}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </Card.Footer>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>
          {data.copy.homepage.publicDashboard.cards.teachers.title}
        </Card.Title>
        <Card.Description>
          {data.copy.homepage.publicDashboard.cards.teachers.description}
        </Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button href="/teachers" variant="outline">
          {data.copy.homepage.publicDashboard.cards.teachers.title}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </Card.Footer>
    </Card.Root>
  </div>
</div>
