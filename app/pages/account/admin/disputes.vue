<script setup lang="ts">
definePageMeta({
  middleware: "account-auth",
})

await navigateTo("/admin/disputes", { replace: true })
</script>
