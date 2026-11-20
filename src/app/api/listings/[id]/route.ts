import { idParam, route } from "@/server/http";
import { getListing } from "@/server/services/listings";

export const GET = route(({ db, params }) => getListing(db, idParam(params.id)));
