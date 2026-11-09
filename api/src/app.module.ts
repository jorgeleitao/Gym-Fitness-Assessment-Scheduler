import { type DynamicModule, Module } from "@nestjs/common";

import { AvaliacoesController } from "./avaliacoes/avaliacoes.controller";
import { AvaliacoesService } from "./avaliacoes/avaliacoes.service";
import { BackupController } from "./backup/backup.controller";
import { BackupService } from "./backup/backup.service";
import { BancoService } from "./banco/banco.service";
import { ClienteController } from "./cliente/cliente.controller";
import { CONFIG, type Configuracao } from "./config";

@Module({})
export class AppModule {
  static com(config: Configuracao): DynamicModule {
    return {
      module: AppModule,
      controllers: [AvaliacoesController, BackupController, ClienteController],
      providers: [{ provide: CONFIG, useValue: config }, BancoService, AvaliacoesService, BackupService],
    };
  }
}
