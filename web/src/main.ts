import { provideHttpClient, withFetch } from "@angular/common/http";
import { provideZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";

import { RaizComponent } from "./app/raiz.component";

bootstrapApplication(RaizComponent, {
  providers: [provideZonelessChangeDetection(), provideHttpClient(withFetch())],
}).catch((e) => console.error(e));
