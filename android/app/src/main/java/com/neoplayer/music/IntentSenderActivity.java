package com.neoplayer.music;

import android.app.Activity;
import android.content.Intent;
import android.content.IntentSender;
import android.os.Bundle;

public class IntentSenderActivity extends Activity {
    public static final String EXTRA_INTENT_SENDER = "intentSender";
    private static final int REQUEST_CODE = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        IntentSender sender = getIntent().getParcelableExtra(EXTRA_INTENT_SENDER);
        if (sender == null) {
            setResult(Activity.RESULT_CANCELED);
            finish();
            return;
        }
        try {
            startIntentSenderForResult(sender, REQUEST_CODE, null, 0, 0, 0);
        } catch (IntentSender.SendIntentException exception) {
            setResult(Activity.RESULT_CANCELED);
            finish();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CODE) {
            setResult(resultCode);
            finish();
        }
    }
}
