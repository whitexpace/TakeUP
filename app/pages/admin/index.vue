<script setup lang="ts">
definePageMeta({
  middleware: ["admin-auth", () => navigateTo("/admin/overview", { replace: true })],
})
</script>
