import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

// This client configuration ensures your login cookie is sent to the server
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      credentials: "include", // <--- This allows the cookie to be sent
    }),
  ],
});
