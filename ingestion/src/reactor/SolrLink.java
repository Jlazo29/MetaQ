package reactor;


import org.apache.http.impl.client.AbstractHttpClient;
import org.apache.solr.client.solrj.*;
import org.apache.solr.client.solrj.impl.HttpSolrClient;
import org.apache.solr.client.solrj.request.QueryRequest;
import org.apache.solr.common.SolrInputDocument;
import java.io.IOException;
import java.util.Collection;
import java.util.HashMap;


/**
 * Created by jorgeluis on 20/05/16.
 */
public class SolrLink {
    // http://localhost:8983/solr/
    // http://ec2-52-53-226-52.us-west-1.compute.amazonaws.com:8983/solr/
    // ubc production: http://137.82.19.141:8443/solr/
    private static final String BASE_URL = "http://localhost:8983/solr/";
    private String user;
    private String pass;
    private HttpSolrClient solrClient;

    /**
     * Constructor method, returns a {@link SolrLink} with a specified
     * core to link to. Valid cores are: "ORFDocs" and "PathwayRuns"
     * See https://wiki.apache.org/solr/Solrj#Adding_Data_to_Solr
     *
     * @param coreName: the name of the Solr core to point to.
     */
    SolrLink(String coreName, String username, String password){
        // new: http://ec2-52-53-226-52.us-west-1.compute.amazonaws.com:8983/solr/
        // http://localhost:8983/solr/#/
        this.solrClient = new HttpSolrClient(BASE_URL + coreName);
        AbstractHttpClient client = (AbstractHttpClient) solrClient.getHttpClient();
        client.addRequestInterceptor(new PreEmptiveBasicAuthenticator(username, password));
        this.user = username;
        this.pass = password;

    }

    /**
     * This method is called to check how many documents are in the current Solr Core
     */
    public long getCount() throws SolrServerException, IOException {
        SolrQuery q = new SolrQuery("*:*");
        q.setRows(0);  // don't actually request any data
        return solrClient.query(q).getResults().getNumFound();
    }


    /**
     * This method is called to index data to Solr.
     * See https://wiki.apache.org/solr/Solrj#Adding_Data_to_Solr
     *
     * @param documents: the {@link java.util.Collection} of {@link org.apache.solr.common.SolrInputDocument}
     *                   to index to Solr.
     */
    public void index(HashMap<String, SolrInputDocument> documents) {

        try {
            solrClient.add(documents.values());
            solrClient.commit();
        } catch (Exception e) {
//            e.printStackTrace();

        }
    }

    /**
     * Method to delete all indexed records in Solr.
     *
     * @throws IOException
     * @throws SolrServerException
     */
    void deleteRecords() throws IOException, SolrServerException {

        solrClient.deleteByQuery("*:*");
        solrClient.commit();
        changeTargetCore("PwayDocs");
        solrClient.deleteByQuery("*:*");
        solrClient.commit();
        System.out.println("Deleting all records...Done");
    }

    void changeTargetCore(String newTarget){
        // http://localhost:8983/solr/#/PwayDocs
        this.solrClient = new HttpSolrClient(BASE_URL + newTarget);
        AbstractHttpClient client = (AbstractHttpClient) solrClient.getHttpClient();
        client.addRequestInterceptor(new PreEmptiveBasicAuthenticator(
                this.user, this.pass));
    }

}
