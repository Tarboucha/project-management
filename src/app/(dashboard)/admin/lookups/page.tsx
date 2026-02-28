"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LookupTab } from "@/components/pages/admin/lookup-tab"

export default function AdminLookupsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lookups</h1>
        <p className="text-muted-foreground">Manage lookup values for projects</p>
      </div>

      <Tabs defaultValue="activities">
        <TabsList>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="activities" className="mt-4">
          <LookupTab type="activities" label="Activity" filterParam="activityId" />
        </TabsContent>
        <TabsContent value="themes" className="mt-4">
          <LookupTab type="themes" label="Theme" filterParam="themeId" />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <LookupTab type="categories" label="Category" filterParam="categoryId" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
