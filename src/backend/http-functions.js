import { ok, serverError } from "wix-http-functions";
import { elevate } from "wix-auth";
import { secrets } from "wix-secrets-backend.v2";

const listSecretInfo = elevate(secrets.listSecretInfo);

// Access at cyc-csc/_functions/greeting
export function get_camps(request) {
    listSecretInfo()
        .then((result) => {
            let secrets = result.secrets ?? [];
            let names = secrets.map((secret) => { return secret.name });

            return ok({
                body: {
                    secretNames: names
                }
            });
        })
        .catch((error) => {
            console.log(error);
        });
}
