import { Module } from "@nestjs/common";
import { InfraModule } from "../../app/infra.module";
import {
  ContractsProcessor,
  DeadlinesProcessor,
  NotificationsProcessor,
  PostEventProcessor,
  ScheduleBootstrap,
  UploadsProcessor,
} from "../../processors";

@Module({
  imports: [InfraModule],
  providers: [
    NotificationsProcessor,
    PostEventProcessor,
    DeadlinesProcessor,
    ContractsProcessor,
    UploadsProcessor,
    ScheduleBootstrap,
  ],
})
export class WorkerModule {}
